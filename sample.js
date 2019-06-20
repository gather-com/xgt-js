const xgt = require('./lib/xgt');

// const addressPrefix = 'TST';
const addressPrefix = 'XGT';
const host = 'http://localhost:8751';
// const chainId = '18dcf0a285365fc58b71f18b3d3fec954aa0c141c44e4e5cb4cf777b9eab274e';
const chainId = '4e08b752aff5f66e1339cb8c0a8bca14c4ebb238655875db7dade86349091197';
// const privateKey = xgt.PrivateKey.fromWif('5JNHfZYKGaomSFvd4NUdQ9qMcEAC43kujbfjueTHpVapX1Kzq2n');
const privateKey = xgt.PrivateKey.fromWif('5JNHfZYKGaomSFvd4NUdQ9qMcEAC43kujbfjueTHpVapX1Kzq2n');
const name = 'foo' + Math.floor(Math.random() * Math.pow(16, 6)).toString(16);
const now = new Date().toISOString().replace(/Z$/, '').replace(/\.\d+$/, '');
const transaction = {
  'expiration': now,
  'extensions': [],
  'operations': [
    [
      'account_create',
      {
        'fee': '0.000 XGT',
        'creator': 'initminer',
        'new_account_name': name,
        'owner': {
          'weight_threshold': 1,
          'account_auths': [],
          'key_auths': [
            [
              'XGT7xue5ESY1xHhDZj6dw2igXCwoHobA3cnxffacvp4XMzwfzLZu4',
              1
            ]
          ]
        },
        'active': {
          'weight_threshold': 1,
          'account_auths': [],
          'key_auths': [
            [
              'XGT6Yp3zeaYNU7XJF2MxoHhDcWT4vGgVkzTLEvhMY6g5tvmwzn3tN',
              1
            ]
          ]
        },
        'posting': {
          'weight_threshold': 1,
          'account_auths': [],
          'key_auths': [
            [
              'XGT5Q7ZdopjQWZMwiyZk11W5Yhvsfu1PG3f4qsQN58A7XfHP34Hig',
              1
            ]
          ]
        },
        'memo_key': 'XGT5u69JnHZ3oznnwn71J6VA4r5oVJX6Xu3dpbFVoHpJoZXnbDfaW',
        'json_metadata': '',
        'extensions': []
      }
    ]
  ],
  'ref_block_num': 34960,
  'ref_block_prefix': 883395518
};

var rpc = new xgt.Rpc(host);
rpc.send('call', ['condenser_api', 'get_chain_properties', []])
  .then(function(response) {
    const fee = response.result.account_creation_fee;
    transaction.operations[0][1].fee = fee;
    xgt.Auth
      .signTransaction(rpc, transaction, [privateKey], addressPrefix, chainId)
      .then(function(signed) {
        return [
          'condenser_api',
          'broadcast_transaction_synchronous',
          [signed]
        ];
      })
      .then(function(op) {
        console.log(JSON.stringify(op));
        return rpc.send('call', op);
      })
      .then(function(body) {
        console.log(body);
      });
  });
