const BigNumber = require('bignumber.js');
const MD5 = require('crypto-js/md5');

const email = "t1@d0m1.com";
const h_email = MD5(email).toString();
console.log('Email:', email);
console.log('MD5 hash:', h_email);

const h_email_ui128 = new BigNumber(h_email, 16).toFixed();
console.log('As uint128:', h_email_ui128);

// Reverse bytes
function invertBytesMd5Hex(s) {
    if (!s || s === undefined || s.length != 32) throw "bad md5 hex string";
    var split = s.match(/.{1,2}/g);
    var reversed = split.slice(0).reverse();
    var ret = '';
    for (var i = 0, len = reversed.length; i < len; i++) {
        ret += reversed[i];
    }
    return ret;
}

const h_email_ui128_reversed = invertBytesMd5Hex(h_email);
console.log('Reversed hex:', h_email_ui128_reversed);
console.log('Reversed as uint128:', new BigNumber('0x' + h_email_ui128_reversed, 16).toFixed());

console.log('\nExpected in table:', '224303559100116969765038775505034856345');
console.log('Matches non-reversed?', h_email_ui128 === '224303559100116969765038775505034856345');
console.log('Matches reversed?', new BigNumber('0x' + h_email_ui128_reversed, 16).toFixed() === '224303559100116969765038775505034856345');
