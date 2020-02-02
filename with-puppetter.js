const puppeteer = require("puppeteer");
const common = require("./common.js");

// =============================================================================
// Consts

const {
  DESK_SELECTION_URL,
  WAIT_DURATION_IF_BANNED,
  WAIT_DURATION,
  WAIT_BETWEEN_DESKS
} = common;

// =============================================================================
// Utils

const {
  timeout,
  pTimeout,
  duration,
  sendNotification,
  sendSuccessMail,
  shuffle
} = common;

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
  const navPromise = page.waitForNavigation({ waitUntil: "networkidle0" });

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
  const desks = shuffle(await getAllDesks(page));

  console.info(`Checking following desks: ${desks} (${desks.length})`);

  for (i = 0; i < desks.length; i++) {
    const deskNb = desks[i];

    await pTimeout(WAIT_BETWEEN_DESKS * (i * 0.5));

    const resp = await isDeskAvailable(page, deskNb);

    if (resp) {
      console.info(`✓ Desk '${deskNb}' is free !!!`);
      return true;
    }

    console.info(
      `X Desk ${i + 1}/${desks.length} -- (${deskNb}) not available`
    );
  }

  return false;
};

// =============================================================================
// Main

async function main() {
  while (true) {
    const browser = await puppeteer.launch({
      headless: false,
      args: ["--no-sandbox", "--disable-setuid-sandbox"]
    });
    const page = await browser.newPage();

    try {
      const success = await checkForFreeDesk(page);
      if (success) {
        console.info("!!! Desk found !!!");
        sendSuccessMail({ hostname: true });
        sendSuccessSms({ hostname: true });
        sendNotification("SUCCESS", "A desk was found");
        await timeout(1000 * 60 * 60 * 48); // U have 48h to come in and fill the form !!!
      } else {
        console.info(`No desk found, closing browser`);
        await browser.close();
        await pTimeout(WAIT_DURATION);
      }
    } catch (e) {
      // If an exception is throwed, it means we are banned
      console.warn(
        `!!! BANNED, Closing browser and wait for ${duration(
          WAIT_DURATION_IF_BANNED
        )} |||`,
        e.toString()
      );

      sendNotification("Banned", `${e.toString()}`);
      await browser.close();
      await pTimeout(WAIT_DURATION_IF_BANNED);
    }
  }
}

module.exports = main;
