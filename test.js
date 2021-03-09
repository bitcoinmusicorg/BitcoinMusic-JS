// "5KBBTudkdv8fnWpXTbD9NqokZPNHjwxYZhnEc8QRbdZWuZcsuuC"

muse.config.set('websocket', 'ws://88.99.64.210:33028'); // initiate soundac websocket
var keys = muse.auth.getPrivateKeys('shery11', 'shery11', ['owner', 'active', 'basic', 'memo', 'roles', 'private', 'posting']);
console.log(keys)



muse.broadcast.assetCreate('5Jmz91XubbKpzDrb24YAfjrCGPwMBzDeLbitsmbCjTDyaueyLiK', "testnet123", "SHERYTEST", "httpgoogle", 0, 1000, (err, result) => {
    console.log(err, result);

});

muse.broadcast.accountCreate(
    '5Jmz91XubbKpzDrb24YAfjrCGPwMBzDeLbitsmbCjTDyaueyLiK',
    { amount: 1, asset_id: "2.28.0" },
    'testnet123',
    'ttest12345',
    {
        'weight_threshold': 1,
        'account_auths': [],
        'key_auths': [[keys.ownerPubkey, 1]]
    },
    {
        'weight_threshold': 1,
        'account_auths': [],
        'key_auths': [[keys.activePubkey, 1]]
    },
    {
        'weight_threshold': 0,
        'account_auths': [],
        'key_auths': [[keys.basicPubkey, 1]]
    }, keys.memoPubkey, {}, function (err, result) {
        console.log(err, result);

    });