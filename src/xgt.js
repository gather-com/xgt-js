import axios from 'axios';
import bs58 from 'bs58';
import { Buffer } from 'buffer';
import createHash from 'create-hash';
import secp256k1 from 'secp256k1-pure';

function getRandomBytes(n) {
  if (typeof window !== 'undefined') {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Buffer.from(array);
  } else {
    const crypto = require('crypto');
    return crypto.randomBytes(32);
  }
}

function sha256(input) {
  return createHash('sha256').update(input).digest();
}

function ripemd160(input) {
  return createHash('ripemd160').update(input).digest();
}

class PrivateKey {
  constructor(key) {
    this.key = key;
  }

  static fromWif(wif) {
    // const buffer = bs58.decode(wif);
    // // const checksum = buffer.slice(-4);
    // const key = buffer.slice(0, -4);
    // // const checksumVerify = sha256(sha256(key)).slice(0, 4);

    // // assert.deepEqual(checksumVerify, checksum, 'private key checksum mismatch');
    // return new PrivateKey(key.slice(1));

    var private_wif = Buffer.from(bs58.decode(wif));
    var version = private_wif.readUInt8(0);
    if (version !== 0x80) {
      throw new Error('Expected version ' + 0x80 + ', instead got ' + version);
    }
    var private_key = private_wif.slice(0, -4);
    var checksum = private_wif.slice(-4);
    var new_checksum = sha256(private_key);
    new_checksum = sha256(new_checksum);
    new_checksum = new_checksum.slice(0, 4);
    if (checksum.toString() !== new_checksum.toString()) {
      throw new Error('Invalid WIF key (checksum mis-match)');
    }

    private_key = private_key.slice(1);
    return new PrivateKey(private_key);
  }

  toPublic(addressPrefix) {
    const buf = secp256k1.publicKeyCreate(this.key);
    const checksum = ripemd160(buf);
    const addy = Buffer.concat([buf, checksum.slice(0, 4)]);
    return addressPrefix + bs58.encode(addy);
  }

  sign(message) {
    let rv;
    let attempts = 0;

    do {
      const joined = Buffer.concat([message, Buffer.alloc(1, ++attempts)]);
      const options = { data: sha256(joined) };

      rv = secp256k1.sign(message, this.key, options);
    } while (!this.isCanonicalSignature(rv.signature));

    const buffer = Buffer.alloc(65);

    buffer.writeUInt8(rv.recovery + 31, 0);
    rv.signature.copy(buffer, 1);
    return buffer.toString('hex');
  }

  isCanonicalSignature(signature) {
    return (!(signature[0] & 0x80) &&
            !(signature[0] === 0 && !(signature[1] & 0x80)) &&
            !(signature[32] & 0x80) &&
            !(signature[32] === 0 && !(signature[33] & 0x80)));
  }
}

class Auth {
  static async transactionDigest(rpc, transaction, keys, addressPrefix, chainId) {
    const body = await rpc.send('network_broadcast_api.get_transaction_hex', [transaction]);
    const transactionHex = body.substring(0, body.length - 2);
    const digest = sha256(Buffer.concat([Buffer.from(chainId, 'hex'), Buffer.from(transactionHex, 'hex')]));
    return digest;
  }

  static async signTransaction(rpc, transaction, keys, addressPrefix, chainId) {
    // TODO: Verify this
    const properties = await rpc.send('database_api.get_dynamic_global_properties', {});
    const chainDate = `${properties.time}Z`;
    const lastIrreversibleBlockNum = properties.last_irreversible_block_num;
    const refBlockNum = (lastIrreversibleBlockNum - 1) & 0xfff;
    const header = await rpc.send('block_api.get_block_header', { block_num: lastIrreversibleBlockNum }).header;
    const headBlockId = (header && header.previous) ? header.previous : '0000000000000000000000000000000000000000'
    const refBlockPrefix = Buffer.from(headBlockId, 'hex').readUInt32LE(4);
    const inFuture = new Date(Date.parse(chainDate) + (5 * 60 * 1000));
    console.log('inFuture', inFuture);
    const expiration = inFuture.toISOString().replace(/(\.\d+)?Z$/, '');
    console.log('expiration', expiration);
    transaction.ref_block_num = refBlockNum
    transaction.ref_block_prefix = refBlockPrefix
    transaction.expiration = expiration

    const digest = await this.transactionDigest(rpc, transaction, keys, addressPrefix, chainId);

    // TODO: Calculate ref_block_num, ref_block_prefix, and expiration
    if (!Array.isArray(transaction.signatures)) {
      transaction.signatures = [];
    }
    for (let i in keys) {
      const signature = PrivateKey.fromWif(keys[i]).sign(digest);
      console.log('key and signature', keys[i], signature);
      transaction.signatures.push(signature);
    }

    return transaction;
  }

  static randomWif() {
    const privateKey = Buffer.concat([Buffer.from('80', 'hex'), getRandomBytes(32)]);
    let checksum = sha256(sha256(privateKey)).slice(0, 4);
    return bs58.encode(Buffer.concat([privateKey, checksum]));
  }

  static generateWif(name, password, role) {
    const brainKey = `${name}${role}${password}`.trim().split(/[\t\n\v\f\r ]+/).join(' ')
    const privateKey = Buffer.concat([Buffer.from('80', 'hex'), sha256(brainKey)]);
    let checksum = sha256(sha256(privateKey)).slice(0, 4);
    return bs58.encode(Buffer.concat([privateKey, checksum]));
  }
}

class RpcError extends Error {
  constructor(message, response) {
    super();
    if (Error.captureStackTrace)
      Error.captureStackTrace(this, RpcError);
    this.name = 'RpcError';
    this.message = message;
    this.response = response;
  }
}

class Rpc {
  constructor(host) {
    this.host = host;
    this.cache = {};
  }

  async send(method, params) {
    const id = Math.floor(Math.random() * Math.pow(16, 6));
    const payload = {
      jsonrpc: '2.0',
      method: method,
      params: params,
      id: id
    };
    const response = await axios({
      method: 'post',
      url: this.host,
      responseType: 'json',
      data: payload
    });
    if (!response.data)
      throw new RpcError('No data in response', response);
    const error = response.data.error
    if (error)
      throw new RpcError(error.message || 'A message-less error occurred', response);
    return response.data.result;
  }

  async broadcastTransaction(transaction, keys, addressPrefix, chainId) {
    const signed = await Auth.signTransaction(this, transaction, keys, addressPrefix, chainId);
    console.log('signed', JSON.stringify(signed, 2));
    const result = await this.send('network_broadcast_api.broadcast_transaction', [signed]);
    console.log('result', result);
    return result.id;
  }

  async isTransactionReady(id) {
    try {
      const result = await this.send('wallet_history_api.get_transaction', { id: id });
      console.log('result', result);
      return true;
    } catch (e) {
      return false;
    }
  }

  async getConfig() {
    if (this.cache.config) return this.cache.config;
    this.cache.config = await this.send('database_api.get_config', {});
    return this.cache.config;
  }

  async getAddressPrefix() {
    return (await this.getConfig()).XGT_ADDRESS_PREFIX;
  }

  async getChainId() {
    return (await this.getConfig()).XGT_CHAIN_ID;
  }
}

export { Auth, PrivateKey, RpcError, Rpc };
