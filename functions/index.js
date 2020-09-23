"use strict";

const Dinero = require("dinero.js");

// Init Firebase
const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();

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

const convertToCurrency = balances =>
  Object.keys(balances).forEach(key => {
    balances[key] = Dinero({ amount: balances[key] }).toFormat();
  });

const fetchAccounts = async items => {
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

const buildResponse = value => ({
  postfix: "Real balance",
  color: Dinero({ amount: value }).isNegative() ? "red" : "green",
  data: { value: Dinero({ amount: value }).toUnit() }
});

app.get("/api", async (req, res) => {
  // Fetch data from Plaid API
  const data = await fetchAccounts(functions.config().plaid.items);

  // Flatten all accounts into single array
  const accounts = data.reduce((acc, cur) => acc.concat(cur.accounts), []);

  // Increment balances based on account type
  const balances = accounts.reduce((acc, { balances: { current }, type }) => {
    acc[type] = (
      (acc[type] && Dinero({ amount: acc[type] })) ||
      Dinero({ amount: 0 })
    )
      .add(Dinero({ amount: current * 100 }))
      .getAmount();

    return acc;
  }, {});

  // Subtract credit from depository balance and add result to object
  balances.total = Dinero({ amount: balances.depository })
    .subtract(Dinero({ amount: balances.credit }))
    .getAmount();

  // Return response
  res.set("Cache-Control", "public, max-age=300, s-maxage=600");
  return res.status(200).send(buildResponse(balances.total));
});

exports.app = functions.https.onRequest(app);
