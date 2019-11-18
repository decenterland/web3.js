const assert = require('assert');
const ganache = require('ganache-cli');
const pify = require('pify');
const Web3 = require('./helpers/test.utils').getWeb3();

describe('subscription connect/reconnect', function() {
    let server;
    let web3;
    let accounts;
    const port = 8545;

    beforeEach(async function() {
        server = ganache.server({port: port, blockTime: 1});
        await pify(server.listen)(port);
        web3 = new Web3('ws://localhost:' + port);
        accounts = await web3.eth.getAccounts();
    });

    afterEach(async function() {
        // Might already be closed..
        try {
            await pify(server.close)();
        } catch (err) {
        }
    });

    it('subscribes (baseline)', function() {
        return new Promise(async function (resolve) {
            web3.eth
                .subscribe('newBlockHeaders')
                .on('data', function(result) {
                    assert(result.parentHash);
                    resolve();
                });
        });
    });

    it('errors when there is no client to connect to (baseline)', async function() {
        await pify(server.close)();

        return new Promise(async function (resolve) {
            web3.eth
                .subscribe('newBlockHeaders')
                .on('error', function(err) {
                    assert(err.message.includes('CONNECTION ERROR'));
                    resolve();
                });
        });
    });

    // This test failing....
    it('auto reconnects', function() {
        this.timeout(6000);

        const ws = new Web3
            .providers
            .WebsocketProvider(
                'ws://localhost:' + port,
                {reconnect: {auto: true}}
            );

        web3.setProvider(ws);

        return new Promise(async function (resolve) {
            // Stage 0: trigger a new Block
            let stage = 0;

            web3.eth
                .subscribe('newBlockHeaders')
                .on('data', async function(result) {
                    assert(result.parentHash);

                    // Exit point, flag set below
                    if (stage === 1) {
                        web3.currentProvider.disconnect();
                        await pify(server.close)();

                        resolve();
                    }
                });

            // Stage 1: Close & re-open server, trigger a new block
            await pify(server.close)();
            server = ganache.server({port: port, blockTime: 1});
            await pify(server.listen)(port);
            stage = 1;
        });
    });
});