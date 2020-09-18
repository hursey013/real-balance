# real-balance

> Discretionary funds less credit card spending via Plaid API + Firebase Functions

## Introduction

Endpoint to provide your current "real" balance using the Plaid API. The function totals up your depository (checking) accounts as well as credit accounts and returns the difference.

Further reading:

- [Firebase SDK for Cloud Functions](https://firebase.google.com/docs/functions)
- [Plaid API Documentation](https://plaid.com/docs/)

## Functions code

See file [functions/index.js](functions/index.js) for the code.

The dependencies are listed in [functions/package.json](functions/package.json).

## Initial setup

### Clone this repo

- Clone or download this repo and open the `real-balance` directory.

### Create a Firebase project

- Create a Firebase Project using the [Firebase Developer Console](https://console.firebase.google.com)
- Enable billing on your project by switching to the Blaze or Flame plan. See [pricing](https://firebase.google.com/pricing/) for more details. This is required to allow requests to non-Google services within the Function.
- Install [Firebase CLI Tools](https://github.com/firebase/firebase-tools) if you have not already, and log in with `firebase login`.
- Configure this sample to use your project using `firebase use --add` and select your project.

### Install dependencies and add environment variables

- Install dependencies locally by running: `cd functions; npm i; cd -`
- [Add your Plaid API credentials](https://dashboard.plaid.com/signup) and basic auth password to the Firebase config:
  ```bash
  firebase functions:config:set \
  plaid.clientid=<YOUR PLAID CLIENT ID> \
  plaid.secret=<YOUR PLAID SECRET> \
  user.password=<YOUR BASIC AUTH PASSWORD>
  ```
- You will also need to add an array of Plaid `access_token`'s for each [Plaid Item](https://plaid.com/docs/#creating-items-with-plaid-link) you would like included in your "real" balance. You may also (optionally) add an array of specific accounts to be used with each `access_token`, otherwise all accounts will included.
  ```bash
  firebase functions:config:set \
  plaid.items.0.token=<FIRST PLAID ACCESS TOKEN> \
  plaid.items.1.token=<ANOTHER PLAID ACCESS TOKEN> \
  plaid.items.1.account_ids.0=<A SPECIFIC ACCOUNT ID> \
  plaid.items.1.account_ids.1=<ANOTHER SPECIFIC ACCOUNT ID>
  ```

### Deploy the app to production

- Deploy your function using `firebase deploy --only functions`
- After deploying the function you can use the your basic auth credentials to access the endpoint at:

```
https://us-central1-<project-id>.cloudfunctions.net/balance
```
