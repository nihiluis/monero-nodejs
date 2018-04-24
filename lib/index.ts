import * as request from "request-promise"

export default class Wallet {
    hostname: string
    port: number
    user: string
    pass: string

    constructor(hostname: string, port: number, user: string, pass: string) {
        this.hostname = hostname || "127.0.0.1"
        this.port = port || 18082
        this.user = user || ""
        this.pass = pass || ""

        // This line is necessary in order to do the initial handshake between this wrapper and monero-wallet-rpc without it, the first request to the wrapper fails (subsequent request succeed, though.)
        this.request("get_balance")
    }

    // general API wallet request
    private request(method: string, params: any = {}) {
        let options = {
            forever: true,
            json: { "jsonrpc": "2.0", "id": "0", "method": method }
        }

        if (params) {
            options["json"]["params"] = params
        }
        if (this.user) {
            options["auth"] = {
                "user": this.user,
                "pass": this.pass,
                "sendImmediately": false
            }
        }
        return request.post(`http://${this.hostname}:${this.port}/json_rpc`, options)
            .then((result) => {
                if (result.hasOwnProperty("result")) {
                    return result.result
                } else {
                    return result
                }
            })
    }

    /**
     * Wallet Methods
     */

    // creates a new wallet
    createWallet(filename: string, password: string, language: string) {
        let method = "create_wallet"
        let params = {
            filename: filename || "monero_wallet",
            "password": password || "",
            "language": language || "English"
        }
        return this.request(method, params)
    }

    // open a wallet
    openWallet(filename: string, password: string) {
        let method = "open_wallet"
        let params = {
            filename: filename || "monero_wallet",
            "password": password || ""
        }
        return this.request(method, params)
    }

    // stops the wallet
    stopWallet() {
        let method = "stop_wallet"
        return this.request(method)
    }

    // returns the wallet balance
    balance() {
        let method = "get_balance"
        return this.request(method)
    }

    // return the wallet address
    address() {
        let method = "get_address"
        return this.request(method)
    }

    // transfer Monero to a single recipient, or a group of recipients
    transfer = function (destinations: [{ amount: number, address: string }],
        options: {
            mixin?: number,
            unlockTime?: number,
            pid?: string,
            doNotRelay?: boolean,
            priority?: number,
            getTxHex?: boolean,
            getTxKey?: boolean,
            newAlgorithm?: boolean
        } = {}) {
        destinations.forEach((dest) => dest.amount = convert(dest.amount))

        let method = "transfer"
        let params = {
            destinations: destinations,
            mixin: options.mixin || 4,
            unlock_time: options.unlockTime || 0,
            payment_id: options.pid || null,
            do_not_relay: options.doNotRelay || false,
            priority: options.priority || 0,
            get_tx_hex: options.getTxHex || false,
            get_tx_key: options.getTxKey || false
        }
        return this._request(method, params)
    }

    // split a transfer into more than one tx if necessary
    transferSplit(destinations: [{ amount: number, address: string }],
        options: {
            mixin?: number,
            unlockTime?: number,
            pid?: string,
            doNotRelay?: boolean,
            priority?: number,
            getTxHex?: boolean,
            getTxKey?: boolean,
            newAlgorithm?: boolean
        } = {}) {
        destinations.forEach((dest) => dest.amount = convert(dest.amount))
        let method = "transfer_split"
        let params = {
            destinations: destinations,
            mixin: options.mixin || 4,
            unlock_time: options.unlockTime || 0,
            payment_id: options.pid || null,
            do_not_relay: options.doNotRelay || false,
            priority: options.priority || 0,
            get_tx_hex: options.getTxHex || false,
            get_tx_key: options.getTxKey || false,
            new_algorithm: options.newAlgorithm || false
        }
        return this.request(method, params)
    }

    // send all dust outputs back to the wallet with 0 mixin
    sweepDust() {
        let method = "sweep_dust"
        return this.request(method)
    }

    // send all dust outputs back to the wallet with 0 mixin
    sweepAll(address: string) {
        let method = "sweep_all"
        let params = { address: address }
        return this.request(method, params)
    }

    // get a list of incoming payments using a given payment ID
    getPayments(pid: string) {
        let method = "get_payments"
        let params = { payment_id: pid }
        return this.request(method, params)
    }

    // get a list of incoming payments using a single payment ID or list of payment IDs from a given height
    getBulkPayments = function (pids: string[], minHeight: number) {
        let method = "get_bulk_payments"
        let params = {
            payment_ids: pids,
            min_block_height: minHeight
        }
        return this.request(method, params)
    }

    // return a list of incoming transfers to the wallet (type can be "all", "available", or "unavailable")
    incomingTransfers = function (type: string) {
        let method = "incoming_transfers"
        let params = { transfer_type: type }
        return this.request(method, params)
    }

    // return the spend key or view private key (type can be "mnemonic" seed or "view_key")
    queryKey(type: string) {
        let method = "query_key"
        let params = { key_type: type }
        return this.request(method, params)
    }

    // make an integrated address from the wallet address and a payment id
    integratedAddress(pid: string) {
        let method = "make_integrated_address"
        let params = { payment_id: pid }
        return this.request(method, params)
    }

    // retrieve the standard address and payment id from an integrated address
    splitIntegrated = function (address: string) {
        let method = "split_integrated_address"
        let params = { integrated_address: address }
        return this.request(method, params)
    }

    // return the current block height
    height() {
        let method = "getheight"
        return this.request(method)
    }
}

// helper function to convert Monero amount to atomic units
function convert(amount) {
    let number: number | string = Number(amount) * 1e12
    // remove any decimals
    number = number.toFixed(0)
    return Number(number)
}
