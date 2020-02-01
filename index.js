const puppeteer = require("puppeteer");
const formatDistance = require("date-fns/formatDistance");
const got = require("got");
const config = require("./config.json");
const sgMail = require("@sendgrid/mail");

// =============================================================================
// Consts

const DESK_SELECTION_URL =
  "http://www.haute-garonne.gouv.fr/booking/create/7736/1";
const WAIT_DURATION_IF_BANNED = 40 * 60; // 40 minutes
const WAIT_DURATION = 5 * 60; // 5 minutes

// =============================================================================
// Utils

const timeout = seconds =>
  new Promise(resolve => setTimeout(resolve, seconds * 1000));

const duration = s => formatDistance(0, s * 1000, { includeSeconds: true });

const sendNotification = (title, message) =>
  got
    .post(`${config.gotifyUrl}/message`, {
      headers: { "X-Gotify-Key": config.gotifyToken },
      json: {
        title: `${config.hostName}: title`,
        message: message,
        priority: 1
      },
      retry: 3
    })
    .catch(ex => {
      console.error("Cannot send notification");
      console.error(ex);
    });

const sendSuccessMail = () => {
  sgMail.setApiKey(config.sendGridApiKey);
  const msg = {
    to: config.sendMailsTo,
    from: "rdv-naturalisation@no-answer.com",
    subject: "Un creneau a été trouvé !!!",
    html: `<strong>Un creneau a été trouvé !!!</strong><br/>
    GO sur la machine <strong>${config.hostName}</strong> pour finaliser l'inscription`
  };
  return sgMail.send(msg).catch(err => console.error(err));
};

// =============================================================================
// Page navigations

const assertNotFail = resp => {
  if ((s = resp.status()) !== 200) {
    throw Error(`Page ${resp.url()} returned a ${s} error`);
  }
};

const getAllDesks = async page => {
  const resp = await page.goto(DESK_SELECTION_URL);

  assertNotFail(resp);

  const desks = await page.$$eval('#FormBookingCreate [type="radio"]', els =>
    els.map(e => e.value)
  );

  return desks;
};

const isDeskAvailable = async (page, deskNumber) => {
  // Go to selection page if not already there
  if (page.url() !== DESK_SELECTION_URL) {
    const resp = await page.goto(DESK_SELECTION_URL);

    assertNotFail(resp);
  }

  await page.click(`[value="${deskNumber}"`);

  // Full redirect promise, to wait after form submission
  const navPromise = page.waitForNavigation({ waitUntil: "domcontentloaded" });

  // Submit form
  await page.click('#FormBookingCreate [type="submit"]');

  // Wait for redirect
  const resp = await navPromise;

  assertNotFail(resp);

  // The desk is free for booking if we are step3
  const success =
    resp
      .url()
      .split("/")
      .pop() === "3";

  return success;
};

const checkForFreeDesk = async page => {
  const desks = await getAllDesks(page);

  console.info(`Checking following desks: ${desks} (${desks.length})`);

  for (deskNb of desks) {
    const resp = await isDeskAvailable(page, deskNb);

    if (resp) {
      console.info(`✓ Desk '${deskNb}' is free !!!`);
      return true;
    }

    console.info(
      `X Desk ${desks.indexOf(deskNb) + 1}/${
        desks.length
      } -- (${deskNb}) not available`
    );
  }

  return false;
};

// =============================================================================
// Main

(async function main() {
  while (true) {
    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();

    try {
      const success = await checkForFreeDesk(page);
      if (success) {
        console.info("!!! Desk found !!!");
        sendSuccessMail();
        sendNotification("SUCCESS", "A desk was found");
        await timeout(60 * 60 * 48); // U have 48h to come in and fill the form !!!
      } else {
        console.info(
          `No desk found, closing browser and wait for ${duration(
            WAIT_DURATION
          )}`
        );
        await browser.close();
        await timeout(WAIT_DURATION);
      }
    } catch (e) {
      // If an exception is throwed, it means we are banned
      console.warn(
        `!!! BANNED, Closing browser and wait for ${duration(
          WAIT_DURATION_IF_BANNED
        )}`
      );

      sendNotification("Banned", `${e.toString()}`);
      await browser.close();
      await timeout(WAIT_DURATION_IF_BANNED);
    }
  }
})();
