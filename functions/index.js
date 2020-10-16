"use strict";

const Dinero = require("dinero.js");

// Init Firebase
const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();

// Init Realtime Database
const db = admin.database();
const ref = db.ref("/");

// Init Express
const express = require("express");
const basicAuth = require("express-basic-auth");
const app = express();
app.use(
  basicAuth({
    users: { admin: functions.config().user.password }
  })
);

// Init Plaid API
const plaid = require("plaid");
const plaidClient = new plaid.Client({
  clientID: functions.config().plaid.clientid,
  secret: functions.config().plaid.secret,
  env: plaid.environments.development
});

// Init Splitwise API
const Splitwise = require("splitwise");
const sw = Splitwise({
  consumerKey: functions.config().splitwise.key,
  consumerSecret: functions.config().splitwise.secret,
  accessToken: functions.config().splitwise.token
});

const convertToCurrency = balances =>
  Object.keys(balances).forEach(key => {
    balances[key] = Dinero({ amount: balances[key] }).toFormat();
  });

const fetchPlaid = async items => {
  const results = [];

  for (const item of items) {
    results.push(
      plaidClient.getBalance(item.token, {
        account_ids: item.account_ids || null
      })
    );
  }

  return await Promise.all(results);
};

const fetchSplitwise = async () => {
  const data = await sw.getFriends();

  return data.reduce(
    (acc, cur) => acc + Number((cur.balance[0] && cur.balance[0].amount) || 0),
    0
  );
};

const buildResponse = async value => {
  // Retrieve paycheck amount from DB
  const snapshot = await ref.once("value");
  const balance = Dinero({ amount: value }).toUnit();

  return {
    postfix: "Real balance",
    color: setColor(balance, snapshot.val().pay),
    data: { value: balance }
  };
};

const setColor = (balance, pay) => {
  // Change background colors based on different thresholds
  if (balance >= pay * 0.5) {
    return "green";
  } else if (balance >= pay * 0.25) {
    return "orange";
  } else {
    return "red";
  }
};

// Increment balances based on account type
const addBalances = plaid => {
  // Flatten all Plaid accounts into single array
  const accounts = plaid.reduce((acc, cur) => acc.concat(cur.accounts), []);

  return accounts.reduce((acc, { balances: { current }, type }) => {
    acc[type] = (
      (acc[type] && Dinero({ amount: acc[type] })) ||
      Dinero({ amount: 0 })
    )
      .add(Dinero({ amount: Math.round(current * 100) }))
      .getAmount();

    return acc;
  }, {});
};

app.get("/api", async (req, res) => {
  try {
    // Fetch data from APIs
    const [plaid, splitwise] = await Promise.all([
      fetchPlaid(functions.config().plaid.items),
      fetchSplitwise()
    ]);

    // Increment balances based on account type
    const balances = addBalances(plaid);

    balances.splitwise = Dinero({
      amount: Math.round(splitwise * 100)
    }).getAmount();

    // Subtract credit from depository balance and add result to object
    balances.total = Dinero({ amount: balances.depository })
      .subtract(Dinero({ amount: balances.credit }))
      .add(Dinero({ amount: balances.splitwise }))
      .getAmount();

    // Log balances object
    functions.logger.info(balances);

    // Return response
    const response = await buildResponse(balances.total);

    res.set("Cache-Control", "public, max-age=300, s-maxage=600");
    return res.status(200).send(response);
  } catch (error) {
    functions.logger.error(error);
    return res.sendStatus(500);
  }
});

exports.app = functions.https.onRequest(app);
