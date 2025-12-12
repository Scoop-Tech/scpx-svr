const Eos_ecc = require('eosjs-ecc');

const ownerKey = "EOS8Ne9o29Ly4gN195rFTsmrdwC5nonyMnMiz3nczVnN1Z9CrsTJi";
const activeKey = "EOS66XnWJbvZ9VKK3TRsD2W72QvFRbvYYzvVJLCFyDAKWvvDNV1ta";

console.log('Testing key validation...');
console.log('Owner key:', ownerKey);
console.log('Owner valid:', Eos_ecc.isValidPublic(ownerKey));
console.log('Active key:', activeKey);
console.log('Active valid:', Eos_ecc.isValidPublic(activeKey));

// Try different validation methods
try {
    const ownerBuffer = Eos_ecc.PublicKey.fromString(ownerKey);
    console.log('Owner PublicKey.fromString: SUCCESS', ownerBuffer.toString());
} catch(e) {
    console.log('Owner PublicKey.fromString: FAILED', e.message);
}

try {
    const activeBuffer = Eos_ecc.PublicKey.fromString(activeKey);
    console.log('Active PublicKey.fromString: SUCCESS', activeBuffer.toString());
} catch(e) {
    console.log('Active PublicKey.fromString: FAILED', e.message);
}
