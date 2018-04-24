import * as request from "request-promise"
import protect, { Result } from "await-protect"

interface RPCCallResponse<T> {
    method: string
    id: string
    result?: T
    error?: RPCCallError
}

interface RPCCallError {
    code: number
    message: string
}

type RPCCallResponseAny = RPCCallResponse<any>

interface Payment {
    amount: number
    payment_id: string
    tx_hash: string
    block_height: number
    unlock_time: number
}

interface Transfer {
    fee: number
    tx_hash: string
    tx_key: string
    tx_blob: string
}

interface IncomingTransfer {
    amount: number
    spent: boolean
    global_index: number
    tx_hash: string
    tx_size: number
}

interface TransferSplitOutput {
    fee_list: number[]
    tx_hash_list: string[]
    tx_blob_list: string[]
    amount_list: number[]
    tx_key_list: string[]
}

export default class Wallet {
    hostname: string
    port: number
    user: string
    pass: string

    constructor(hostname: string, port: number, user: string = "", pass: string = "") {
        this.hostname = hostname || "127.0.0.1"
        this.port = port || 18082
        this.user = user || ""
        this.pass = pass || ""

        // This line is necessary in order to do the initial handshake between this wrapper and monero-wallet-rpc without it, the first request to the wrapper fails (subsequent request succeed, though.)
        this.request("get_balance")
    }

    // general API wallet request
    private async request<T>(method: string, params: any = {}): Promise<Result<T, Error>> {
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


        let { res, err } = await protect<RPCCallResponseAny, any>(request.post(`http://${this.hostname}:${this.port}/json_rpc`, options))

        if (err) {
            // I dont know whether this is an actual Error (maybe it has at least a message field)
            return Result.err(err)
        }

        if (res!!.error) {
            return Result.err(new Error(res!!.error!!.message))
        }

        if (!res!!.result) {
            return Result.err(new Error("Found corrupted Monero JSON RPC response."))
        }

        const body = res!!.result as T

        return Result.ok(body)
    }

    /**
     * Wallet Methods
     */

    // creates a new wallet
    async createWallet(filename: string, password: string, language: string): Promise<Result<{}, Error>> {
        let method = "create_wallet"
        let params = {
            filename: filename || "monero_wallet",
            "password": password || "",
            "language": language || "English"
        }
        return await this.request(method, params)
    }

    // open a wallet
    async openWallet(filename: string, password: string): Promise<Result<{}, Error>> {
        let method = "open_wallet"
        let params = {
            filename: filename || "monero_wallet",
            "password": password || ""
        }
        return await this.request(method, params)
    }

    // stops the wallet
    async stopWallet(): Promise<Result<{}, Error>> {
        let method = "stop_wallet"
        return await this.request(method)
    }

    // returns the wallet balance
    async getBalance(): Promise<Result<{ balance: number, unlocked_balance: number }, Error>> {
        let method = "get_balance"
        return await this.request<{ balance: number, unlocked_balance: number }>(method)
    }

    // return the wallet address
    async address(): Promise<Result<string, Error>> {
        let method = "get_address"

        const r = await this.request<{ address: string }>(method)
        if (r.res) {
            return Result.ok(r.res.address)
        }

        return r as Result<any, Error>
    }

    // transfer Monero to a single recipient, or a group of recipients
    async transfer(destinations: [{ amount: number, address: string }],
        options: {
            mixin?: number,
            unlockTime?: number,
            pid?: string,
            doNotRelay?: boolean,
            priority?: number,
            getTxHex?: boolean,
            getTxKey?: boolean,
            newAlgorithm?: boolean
        } = {}): Promise<Result<Transfer, Error>> {
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
        return await this.request<Transfer>(method, params)
    }

    // split a transfer into more than one tx if necessary
    async transferSplit(destinations: [{ amount: number, address: string }],
        options: {
            mixin?: number,
            unlockTime?: number,
            pid?: string,
            doNotRelay?: boolean,
            priority?: number,
            getTxHex?: boolean,
            getTxKey?: boolean,
            newAlgorithm?: boolean
        } = {}): Promise<Result<TransferSplitOutput, Error>> {
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
        return this.request<TransferSplitOutput>(method, params)
    }

    // send all dust outputs back to the wallet with 0 mixin
    async sweepDust(): Promise<Result<string[], Error>> {
        let method = "sweep_dust"

        const r = await this.request<{ tx_hash_list: string[] }>(method)
        if (r.res) {
            return Result.ok(r.res.tx_hash_list)
        }

        return r as Result<any, Error>
    }

    // send all dust outputs back to the wallet with 0 mixin
    async sweepAll(address: string): Promise<Result<{ tx_hash_list: string[], tx_key_list?: string[], tx_blob_list?: string[] }, Error>> {
        let method = "sweep_all"
        let params = { address: address }
        return await this.request<{ tx_hash_list: string[], tx_key_list?: string[], tx_blob_list?: string[] }>(method, params)
    }

    // get a list of incoming payments using a given payment ID
    async getPayments(pid: string): Promise<Result<Payment[], Error>> {
        let method = "get_payments"
        let params = { payment_id: pid }

        const r = await this.request<{ payments: Payment[] }>(method, params)
        if (r.res) {
            return Result.ok(r.res.payments)
        }

        return r as Result<any, Error>
    }

    // get a list of incoming payments using a single payment ID or list of payment IDs from a given height
    async getBulkPayments(pids: string[], minHeight: number): Promise<Result<Payment[], Error>> {
        let method = "get_bulk_payments"
        let params = {
            payment_ids: pids,
            min_block_height: minHeight
        }

        const r = await this.request<{ payments: Payment[] }>(method, params)
        if (r.res) {
            return Result.ok(r.res.payments)
        }

        return r as Result<any, Error>
    }

    // return a list of incoming transfers to the wallet (type can be "all", "available", or "unavailable")
    async incomingTransfers(type: string): Promise<Result<IncomingTransfer[], Error>> {
        let method = "incoming_transfers"
        let params = { transfer_type: type }

        const r = await this.request<{ transfers: IncomingTransfer[] }>(method, params)
        if (r.res) {
            return Result.ok(r.res.transfers)
        }

        return r as Result<any, Error>
    }

    // return the spend key or view private key (type can be "mnemonic" seed or "view_key")
    async queryKey(type: string): Promise<Result<string, Error>> {
        let method = "query_key"
        let params = { key_type: type }
        const r = await this.request<{ key: string }>(method, params)
        if (r.res) {
            return Result.ok(r.res.key)
        }
        return r as Result<any, Error>
    }

    // make an integrated address from the wallet address and a payment id
    async makeIntegratedAddress(pid: string): Promise<Result<string, Error>> {
        let method = "make_integrated_address"
        let params = { payment_id: pid }
        const r = await this.request<{ integrated_address: string }>(method, params)
        if (r.res) {
            return Result.ok(r.res.integrated_address)
        }
        return r as Result<any, Error>
    }

    // retrieve the standard address and payment id from an integrated address
    async splitIntegratedAddress(address: string): Promise<Result<{ standard_address: string, payment: string }, Error>> {
        let method = "split_integrated_address"
        let params = { integrated_address: address }
        return this.request<{ standard_address: string, payment: string }>(method, params)
    }

    // return the current block height
    async getHeight(): Promise<Result<number, Error>> {
        let method = "getheight"
        const r = await this.request<{ height: number }>(method)
        if (r.res) {
            return Result.ok(r.res.height)
        }
        return r as Result<any, Error>
    }
}

// helper function to convert Monero amount to atomic units
function convert(amount): number {
    let number: number | string = Number(amount) * 1e12
    // remove any decimals
    number = number.toFixed(0)
    return Number(number)
}
