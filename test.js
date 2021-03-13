// "5KBBTudkdv8fnWpXTbD9NqokZPNHjwxYZhnEc8QRbdZWuZcsuuC"

muse.config.set('websocket', 'ws://88.99.64.210:33028'); // initiate soundac websocket
var keys = muse.auth.getPrivateKeys('shery11', 'shery11', ['owner', 'active', 'basic', 'memo', 'roles', 'private', 'posting']);
console.log(keys)


muse.broadcast.assetCreate('5JHQXzo8kn84XQmVXUHAoBnvvJQDCgtzLPeA8epa8sWDz5ZPZRh', "100.000000 2.28.2", "shery11", "ABC", 0, {
    "max_supply": 1000,
    "market_fee_percent": 0,
    "max_market_fee": 30000000000000,
    "issuer_permissions": 73,
    "flags": 68,
    "description": "blah",
}, (err, result) => {
    console.log(err, result);

});

muse.broadcast.assetIssue("5HzJQB1XgfjnhbfGoZU5iNZngD8od16avgvwxUwAcBfUDHB5GVm", "shery11", { amount: 100, asset_id: "2.28.21" }, "shery11", function (d) {
    console.log(d)
})

muse.broadcast.assetCreate('5JHQXzo8kn84XQmVXUHAoBnvvJQDCgtzLPeA8epa8sWDz5ZPZRh', "shery11", "ABC", "this is a description", 0, 1000, (err, result) => {
    console.log(err, result);

});


muse.config.set('websocket', 'ws://88.99.64.210:33028');
muse.api.getAsset("2.28.8").then(d => { console.log(d) })


muse.config.set('websocket', 'ws://88.99.64.210:33028');
muse.broadcast.assetIssue("5HzJQB1XgfjnhbfGoZU5iNZngD8od16avgvwxUwAcBfUDHB5GVm", "shery11", { amount: 1, asset_id: "2.28.21" }, "shery11", function (d) {
    console.log(d)
})

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