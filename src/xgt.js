import axios from 'axios';
import bs58 from 'bs58';
import { Buffer } from 'buffer';
import crypto from 'crypto';
import secp256k1 from 'secp256k1';

function sha256(input) {
  return crypto.createHash('sha256').update(input).digest();
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

    var private_wif = new Buffer(bs58.decode(wif));
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
      throw new Error('Invalid WIF key (checksum miss-match)');
    }

    private_key = private_key.slice(1);
    return new PrivateKey(private_key);
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
    const body = await rpc.send('condenser_api.get_transaction_hex', [transaction]);
    console.log('body', body);
    const transactionHex = body.result.substring(0, body.result.length - 2);
    const digest = sha256(Buffer.concat([Buffer.from(chainId, 'hex'), Buffer.from(transactionHex, 'hex')]));

    return digest;
  }

  static async signTransaction(rpc, transaction, keys, addressPrefix, chainId) {
    console.log('signTransaction', rpc, transaction, keys, addressPrefix, chainId);
    const digest = await this.transactionDigest(rpc, transaction, keys, addressPrefix, chainId);

    // TODO: Calculate ref_block_num, ref_block_prefix, and expiration
    if (!Array.isArray(transaction.signatures)) {
      transaction.signatures = [];
    }
    for (let i in keys) {
      const signature = keys[i].sign(digest);

      transaction.signatures.push(signature);
    }

    return transaction;
  }
}

class Rpc {
  constructor(host) {
    this.host = host;
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

    return response.data;
  }
}

export { Auth, PrivateKey, Rpc };
