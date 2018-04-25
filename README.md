# monero-wallet-ts

A Node.js wallet manager for interacting with `monero-wallet-rpc`. All methods follow the official wallet rpc documentation. You can easy use await-syntax with all the promises.

For more information about Monero, visit: https://getmonero.org

If you found this useful, please consider [contributing](https://getmonero.org/get-started/contributing/) to the Monero Project!

## Install the package

Via github

## Initializing a wallet

Import module

```
import MoneroWallet from "monero-wallet-ts"
```

Create a new instance of the wallet:

```
const wallet = new MoneroWallet()
```

This creates a wallet using the following simplewallet default RPC settings:

* `hostname` - '127.0.0.1'
* `port` - 18082

To connect to a wallet with different settings, pass in the values:

```
const wallet = new MoneroWallet($HOSTNAME, $PORT);
```