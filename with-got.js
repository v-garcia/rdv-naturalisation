const common = require("./common.js");
const got = require("got");
const { CookieJar } = require("tough-cookie");
const cheerio = require("cheerio");

// =============================================================================
// Consts

const {
  DESK_SELECTION_URL,
  WAIT_DURATION_IF_BANNED,
  WAIT_DURATION,
  WAIT_BETWEEN_DESKS
} = common;
const COOKIE_VALUE = "p3q8jt9bnpn9usdimjtl8r60u5";

// =============================================================================
// Utils

const {
  pTimeout,
  duration,
  sendNotification,
  sendSuccessMail,
  shuffle,
  sendSuccessSms
} = common;

const isDeskAvailable = async deskNumber => {
  const cookieJar = new CookieJar();
  cookieJar.setCookieSync(
    `eZSESSID=${COOKIE_VALUE}`,
    "www.haute-garonne.gouv.fr"
  );
  const resp = await got.post(DESK_SELECTION_URL, {
    form: {
      planning: deskNumber,
      nextButton: "Etape+suivante"
    },
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    cookieJar
  });

  const $ = cheerio.load(resp.body);

  const sorryText =
    $("#FormBookingCreate") &&
    $("#FormBookingCreate")
      .text()
      .trim();

  return !/^Il n\'existe plus/.test(sorryText);
};

const getAllDesks = async () => {
  const resp = await got.post(DESK_SELECTION_URL);

  const $ = cheerio.load(resp.body);

  const desks = $('#FormBookingCreate [type="radio"]')
    .map((e, el) => $(el).val())
    .toArray();

  return desks;
};

const checkForFreeDesk = async () => {
  const desks = shuffle(await getAllDesks());

  console.info(`Checking following desks: ${desks} (${desks.length})`);

  for (i = 0; i < desks.length; i++) {
    const deskNb = desks[i];

    await pTimeout(WAIT_BETWEEN_DESKS * (i * 0.5));

    const resp = await isDeskAvailable(deskNb);

    if (resp) {
      console.info(`✓ Desk '${deskNb}' is free !!!`);
      return deskNb;
    }

    console.info(
      `X Desk ${i + 1}/${desks.length} -- (${deskNb}) not available`
    );
  }

  return false;
};

async function main() {
  await sendSuccessSms({ desk: "2038" });
  return;
  while (true) {
    try {
      const success = await checkForFreeDesk();
      if (success) {
        console.info("!!! Desk found !!!");
        sendSuccessMail({ desk: success });
        sendSuccessSms({ desk: success });
        sendNotification("SUCCESS", `A desk was found (desk:${success})`);
      } else {
        console.info(`No desk found waiting for ${duration(WAIT_DURATION)}`);
      }
      // Lol we continue spamming even if found
      await pTimeout(WAIT_DURATION);
    } catch (e) {
      // If an exception is throwed, it means we are banned
      console.warn(
        `!!! BANNED, Closing browser and wait for ${duration(
          WAIT_DURATION_IF_BANNED
        )} |||`,
        e.toString()
      );

      sendNotification("Banned", `${e.toString()}`);
      await pTimeout(WAIT_DURATION_IF_BANNED);
    }
  }
}

module.exports = main;
