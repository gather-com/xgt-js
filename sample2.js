const xgt = require('./lib/xgt');

async function runExamples () {
  const addressPrefix = 'XGT';
  const host = 'http://98.33.76.100:8771'
  const rpc = new xgt.Rpc(host)
  const privateKey = xgt.Auth.randomWif();
  console.info('private key', privateKey);
  const publicKey = xgt.PrivateKey.fromWif(privateKey).toPublic(addressPrefix);
  console.info('public key', publicKey);
  const walletNameResponse = await rpc.send('wallet_by_key_api.generate_wallet_name', { recovery_keys: [publicKey] })
  const walletName = walletNameResponse.wallet_name;
  console.info('wallet name', walletName);
  const walletName2 = await xgt.Auth.generateWalletName(publicKey);
  console.info('wallet name', walletName2);
}

runExamples().then(() => console.info('Done!'))
