const formatDistance = require("date-fns/formatDistance");
const got = require("got");
const sgMail = require("@sendgrid/mail");
const config = require("./config");
const twilio = require("twilio");
const format = require("date-fns/format");

const WAIT_DURATION_IF_BANNED = 40 * 60 * 1000; // 40 minutes
const WAIT_DURATION = 15 * 60 * 1000; // 15 minutes
const WAIT_BETWEEN_DESKS = 60 * 1000; // 60 seconds
const DESK_SELECTION_URL =
  "http://www.haute-garonne.gouv.fr/booking/create/7736/1";

const timeout = t => {
  console.info(
    `Waiting for ${duration(WAIT_DURATION)} (starting ${format(
      new Date(),
      "HH:mm"
    )})`
  );
  return new Promise(resolve => setTimeout(resolve, t));
};

// Poisson distribution timeout
const pTimeout = t => timeout(-Math.log(Math.random()) * t);

const duration = s => formatDistance(0, s, { includeSeconds: true });

const sendNotification = (title, message) =>
  got
    .post(`${config.gotifyUrl}/message`, {
      headers: { "X-Gotify-Key": config.gotifyToken },
      json: {
        title: `${config.hostName}: ${title}`,
        message: message,
        priority: 1
      },
      retry: 3
    })
    .catch(ex => {
      console.error("Cannot send notification");
      console.error(ex);
    });

const sendSuccessMail = ({ hostname, desk }) => {
  sgMail.setApiKey(config.sendGridApiKey);
  const msg = {
    to: config.sendMailsTo,
    from: "rdv-naturalisation@no-answer.com",
    subject: "Naturalisation: Un creneau a été trouvé !!!",
    html:
      "<strong>Un creneau a été trouvé !!!</strong><br/>" +
      (hostname
        ? `GO sur la machine <strong>${config.hostName}</strong> pour finaliser l'inscription <br/>`
        : "") +
      (desk ? `Guichet libre : ${desk}<br/>` : "")
  };
  return sgMail.send(msg).catch(e => console.error(e));
};

const sendSuccessSms = ({ hostname, desk }) => {
  var client = new twilio(config.twilioAccountSid, config.twilioAuthToken);

  return client.messages
    .create({
      body:
        `Naturalisation: Un creneau a été trouvé !!!` +
        (hostname ? ` | machine: ${config.hostName}` : "") +
        (desk ? ` | guichet: ${desk}` : ""),
      to: config.sendsSmsTo,
      from: config.twilioFromNumber
    })
    .catch(e => console.error(e));
};

const shuffle = a => {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

module.exports = {
  WAIT_DURATION_IF_BANNED,
  WAIT_DURATION,
  WAIT_BETWEEN_DESKS,
  DESK_SELECTION_URL,
  timeout,
  pTimeout,
  duration,
  sendNotification,
  sendSuccessMail,
  shuffle,
  sendSuccessSms
};
