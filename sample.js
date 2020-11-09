const xgt = require('./lib/xgt');

const host = 'http://98.33.76.100:8771'
const run = async () => {
  // Example 1: Extracting public key string from private key string
  {
    console.info('Example 1');
    const addressPrefix = 'XGT';
    const privateKey = '5JNHfZYKGaomSFvd4NUdQ9qMcEAC43kujbfjueTHpVapX1Kzq2n';
    const publicKey = xgt.PrivateKey.fromWif(privateKey).toPublic(addressPrefix);
    console.info('Keypair', privateKey, publicKey);
  }

  // Example 2: Getting the Chain ID and address prefix
  {
    console.info('Example 2');
    const rpc = new xgt.Rpc(host)
    const chainId = await rpc.getChainId();
    const addressPrefix = await rpc.getAddressPrefix();
    console.info('Chain ID and address prefix', chainId, addressPrefix);
  }

  // Example 3: Generating a recovery keypair
  {
    console.info('Example 3');
    const rpc = new xgt.Rpc(host)
    const addressPrefix = await rpc.getAddressPrefix();
    const owner = 'XGT0000000000000000000000000000000000000000';
    const master = xgt.Auth.randomWif();
    const recoveryPrivate = xgt.Auth.generateWif(owner, master, 'recovery');
    const recoveryPublic = xgt.PrivateKey.fromWif(recoveryPrivate).toPublic(addressPrefix);
    console.info('master', master);
    console.info('recoveryPrivate', recoveryPrivate);
    console.info('recoveryPublic', recoveryPublic);
  }

  // Example 4: Generating a wallet name
  {
    console.info('Example 4');
    const rpc = new xgt.Rpc(host)
    const chainId = await rpc.getChainId();
    const addressPrefix = await rpc.getAddressPrefix();
    const owner = 'XGT0000000000000000000000000000000000000000';
    const wif = '5JNHfZYKGaomSFvd4NUdQ9qMcEAC43kujbfjueTHpVapX1Kzq2n';
    const master = xgt.Auth.randomWif();
    const generateKeypair = (role) => {
      const privateKey = xgt.Auth.generateWif(owner, master, 'recovery');
      const publicKey = xgt.PrivateKey.fromWif(privateKey).toPublic(addressPrefix);
      return [privateKey, publicKey];
    }
    const [recoveryPrivate, recoveryPublic] = generateKeypair('recovery');
    const [moneyPrivate, moneyPublic] = generateKeypair('money');
    const [socialPrivate, socialPublic] = generateKeypair('social');
    const [memoPrivate, memoPublic] = generateKeypair('memo');
    const walletNameResponse = await rpc.send('wallet_by_key_api.generate_wallet_name', { recovery_keys: [recoveryPublic] })
    const walletName = walletNameResponse.wallet_name;
    console.log('walletName', walletName);
  }

  // Example 5: Transfer and redeem
  {
    console.info('Example 5');
    const rpc = new xgt.Rpc(host)
    const chainId = await rpc.getChainId();
    const addressPrefix = await rpc.getAddressPrefix();
    const owner = 'XGT0000000000000000000000000000000000000000';
    const wif = '5JNHfZYKGaomSFvd4NUdQ9qMcEAC43kujbfjueTHpVapX1Kzq2n';
    const master = xgt.Auth.randomWif();
    const generateKeypair = (role) => {
      const privateKey = xgt.Auth.generateWif(owner, master, 'recovery');
      const publicKey = xgt.PrivateKey.fromWif(privateKey).toPublic(addressPrefix);
      return [privateKey, publicKey];
    }
    const [recoveryPrivate, recoveryPublic] = generateKeypair('recovery');
    const [moneyPrivate, moneyPublic] = generateKeypair('money');
    const [socialPrivate, socialPublic] = generateKeypair('social');
    const [memoPrivate, memoPublic] = generateKeypair('memo');
    const walletNameResponse = await rpc.send('wallet_by_key_api.generate_wallet_name', { recovery_keys: [recoveryPublic] })
    const walletName = walletNameResponse.wallet_name;

    {
      const transaction = {
        'extensions': [],
        'operations': [{
          type: 'transfer_operation',
          value: {
            amount: {
              amount: '1',
              precision: 3,
              nai: '@@000000021'
            },
            from: owner,
            to: walletName,
            memo: '',
          }
        }]
      };
      const id = await rpc.broadcastTransaction(transaction, [wif], addressPrefix, chainId);
      for (;;) {
        const isReady = await rpc.isTransactionReady(id);
        if (isReady) break;
        console.info('Waiting...');
        await new Promise(res => setTimeout(res, 1000));
      }
      console.log('id', id);
    }

    {
      const transaction = {
        'extensions': [],
        'operations': [{
          type: 'wallet_update_operation',
          value: {
            wallet: walletName,
            recovery: {
              weight_threshold: 1,
              account_auths: [],
              key_auths: [['XGT7xue5ESY1xHhDZj6dw2igXCwoHobA3cnxffacvp4XMzwfzLZu4', 1]]
            },
            money: {
              weight_threshold: 1,
              account_auths: [],
              key_auths: [['XGT6Yp3zeaYNU7XJF2MxoHhDcWT4vGgVkzTLEvhMY6g5tvmwzn3tN', 1]]
            },
            social: {
              weight_threshold: 1,
              account_auths: [],
              key_auths: [['XGT5Q7ZdopjQWZMwiyZk11W5Yhvsfu1PG3f4qsQN58A7XfHP34Hig', 1]]
            },
            memo_key: 'XGT5u69JnHZ3oznnwn71J6VA4r5oVJX6Xu3dpbFVoHpJoZXnbDfaW',
          }
        }]
      }

      const id = await rpc.broadcastTransaction(transaction, [recoveryPrivate], addressPrefix, chainId);
      for (;;) {
        const isReady = await rpc.isTransactionReady(id);
        if (isReady) break;
        console.info('Waiting...');
        await new Promise(res => setTimeout(res, 1000));
      }
      console.log('id', id);
    }
  }
}

run();
