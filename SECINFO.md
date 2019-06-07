# Scoop Wallet Security
Release Candidate 4

## Overview

Scoop uses three independent cryptographic layers to provide secure data transit and storage in its Encrypyting Storage Model:

  * Web Wallet ("**L0**") Encryption - [```redux-persist```](https://github.com/rt2zz/redux-persist) data store data is encrypted with ```fp_cur_browserID```
  * Core Wallet ("**L1**") Encryption - user asset and data fields are encrypted with ```h_mpk``` and salted with ```apk``` and ```opk```
  * API Server ("**L2**") Encryption - user asset and data fields are encrypted with unique passphrases and salted with unique combinations of ```[e_email, owner]```

Cryptography for all three layers is done by [crypto-js](https://github.com/brix/crypto-js) 256-bit AES cipher.

The [Core Wallet](https://github.com/Scoop-Tech/scpx-wallet) manages origination of Master Private Keys (MPKs), derivation and L1 encryption of resulting sub-asset private keys, and -- if you use the Web Wallet or the CLI ```wallet-server-load``` or ```wallet-server-save``` commands -- dispatch of L1-encrypted user and asset data to the API Server's [endpoints](#Scoop-API-Server).

The [API Server](https://github.com/Scoop-Tech/scpx-svr/) provides authentication, L2 encryption of L1-encrypted data, and persistence of resulting (L1+L2) double-encrypted data to the [Data Storage Contract](https://github.com/Scoop-Tech/scpx-eos) ("**DSC**").

The [Web Wallet](https://scoop.tech) performs L0 encryption of data from its embedded Core Wallet, and persistence of the resulting (L1+L0) double-encrypted data in browser [Web Storage](https://developers.google.com/web/fundamentals/instant-and-offline/web-storage/) through [redux-persist](https://github.com/rt2zz/redux-persist). This store is ```SessionStorage```, except when running as a mobile homescreen Progressive Web App, when it is  ```LocalStorage```. All Web Storage is cleared manually of sensitive fields on session logout, and the default ```SessionStorage``` is also automatically cleared by the browser upon session termination.

## Scoop Web Wallet

Below is a summary of sensitive browser data fields and their usage:

* ```mpk``` Master Private Key (MPK)
  * Source: user-supplied on session login, produced by [eosjs-keygen](https://www.npmjs.com/package/eosjs-keygen) on account creation
  * Usage: derivation seed for ```h_mpk```, ```e_mpk```, ```apk```, ```opk``` and entropy for sub-asset private key data
  * Persisted: in-memory/transient

* ```h_mpk``` hash of MPK
  * Source: PBKDF2 hash of MPK and salted with ```apk```
  * Usage: encryption passphrase for ```e_mpk``` and for L1-encryption of sub-asset private key data and user settings data
  * Persisted: ```document.hjs_mpk``` (JS global scope var) - always written at login, and has global scope for the Web Wallet code
  * Persisted: ```PATCH_H_MPK``` (Web Storage) - written at login to allow login persistence across page reloads, unless the user setting option "High Security" is set

* ```e_mpk``` encrypted MPK
  * Source: MPK encrypted with ```h_mpk``` and salted with ```owner```
  * Usage: to display the logged-in account's plaintext MPK
  * Persisted: ```e_mpk``` (Web Storage) - always written at login

* ```apk``` - Active Public Key 
  * Source: [eosjs-keygen](https://www.npmjs.com/package/eosjs-keygen)
  * Usage: encryption salt value for L1-encryption of sub-asset private key data
  * Persisted: ```apk``` (Web Storage) - always written at login

* ```opk``` - Owner Public Key
  * Source: [eosjs-keygen](https://www.npmjs.com/package/eosjs-keygen)
  * Usage: encryption salt value for L1-encryption of user settings data
  * Persisted: ```opk``` (Web Storage) - always written at login

* ```e_email``` 
  * Source: user-supplied pseudo-email encrypted with ```h_mpk``` and salted with ```apk```
  * Usage: authentication of Scoop API Server endpoints ```/api/login_v2```, ```/api/assets``` and ```/api/data``` (see below)
  * Persisted: ```e_email``` (Web Storage) - always written at login

* ```owner``` EOS account owner of the MPK in the DSC
  * Source: Scoop [nodeos](https://github.com/EOSIO/eos) instance, returned by the DSC
  * Usage: encryption salt value for ```e_mpk```
  * Persisted: ```owner``` (Web Storage) - always written at login

* ```fp_cur_browserID``` browser fingerprint
  * Source: [fingerprintjs2](https://www.npmjs.com/package/fingerprintjs2)
  * Usage: encryption passphrase for L0-encryption of ```redux-persist``` store data 
  * Persisted: in-memory/transient

* ```FP_H_BROWSER_ID``` hash of browser fingerprint
  * Source: SHA256 hash of ```fp_cur_browserID```
  * Usage: used to determine when the browser fingerprint has changed, requiring purge and re-initialization of the L0-encrytion of the redux store
  * Persisted: ```FP_H_BROWSER_ID``` (Web Storage) - always written on page load

## Scoop API Server

The [API Server](https://github.com/Scoop-Tech/scpx-svr/) performs authorization on data modification and read requests, and L2 encryption and decryption of data being passed in and out of the DSC. This server-origin encryption and decryption is the secondary layer and supplements the primary L1 encryption performed in the browser or CLI by the Core Wallet.

### Encrypting Storage Model

Wallet account data for Scoop Web Wallet accounts is held in the Scoop DSC ```users_table``` multi-index EOS table. The Web Wallet and the API Server work together such that the fields in the table are encrypted as follows:

  * ```owner``` - plaintext - primary key
  * ```e_email``` - **encrypted** by Core Wallet in browser or in CLI (L1) and by server (L2)
  * ```h_email_ui128``` - plaintext - secondary key
  * ```created_at``` - plaintext
  * ```assets_json``` - **encrypted** by Core Wallet in browser or in CLI (L1) and by server (L2)
  * ```data_json``` - **encrypted** by Core Wallet in browser or in CLI (L1) and by server (L2)
  * ```ex1``` - not currently used
  * ```ex2``` - not currently used

L2 server cryptography for each of the three encrypted fields is performed with three different fixed 128-byte base-62 string for the passphrases and the salts are one of three different account-unique MD5 hashes of values from the set: ```[e_email, owner]```.

The ```assets_json``` field has a further transformation applied to it: [LZString](http://pieroxy.net/blog/pages/lz-string/index.html) UTF16 compression/decompression. This is to reduce blockchain data-storage requirements (by approximately 50%).

### Account Creation (```/api/new_account```)

The Scoop Server account-creation API takes the following parameters: 

  * ```req.body.e_email``` - the L1-encrypted email address supplied by the new user
  * ```req.body.publicKeys``` - the public keys associated with the MPK generated by the client and presented to the new user
  * ```req.body.h_email``` - the MD5 hash of the email address supplied by the the new user

Acount creation consists of the following two distinct transactions executed by server against the SCPX EOS chain:
    
  * Standard EOS account-creation including delegation of RAM and bandwidth to the new account (```eos.transaction{ newaccount... buyram... delegatebw }```)
  * Invoking of the DSC's ```newuser``` method with the following parameters:
    * ```scp_account``` - the plaintext SCPX EOS chain account name, generated by the server at ```eos_lib.gen_account_name()```
    * ```e_email``` - the (L1+L2)-encrypted value resulting after the server applies its L2 encryption to the client-supplied L1-encrypted ```req.body.e_email``` value
    * ```e_hash_hex128``` - the client-supplied ```req.body.h_email``` value

### Authentication - Login (```/api/login_v2```)

In traditional login models a server determines if a login request is successful by comparing a supplied password or other key values to known values in a database. Because Scoop is decentralized and does not store passwords in any database or data store, its login process is different. 

Login to the Scoop client (Web Wallet or Core Wallet CLI) is done by combination of a registered email address (which may be an anonymous or non-existing email address; any string will suffice, but the Web Wallet enforces an email address format) and by an MPK. The MPK is the deterministic source for sub-asset private key generation (as well as L1 decryption), it is never transmitted to the API Server.

The role of the login method is to return L2-decrypted data to the client, for the client to then attempt L1 decryption of the data in the browser or CLI with the user's supplied MPK. The ```/api/login_v2``` method minimizes brute-force L1 attack vectors by only returning L2-decrypted data for an authenticated request. It does this by taking two parameters from the client:

  * ```req.body.e_email``` - the L1-encrypted email address of the user attempting login
  * ```req.body.h_email``` - the MD5 hash of the email address of the user attempting login

It then performs a lookup in the DSC by secondary key (```req.body.e_email```) and retreives (L1+L2)-encrypted data for the identified row. It performs L2 decryption on the returned (L1+L2)-encrypted email address (```user.e_email```) and only returns L2-decrypted data to the client (for all encrypted fields: ```dec_e_email```, ```dec_assets_json```, ```dec_data_json```) if the L2-decrypted email address matches the value of the supplied L1-encrypted email address by the client. In effect, the server checks that the encrypted data it is returning belongs to the user who is requesting it.

The client then completes the login process by checking that the EOS account name for the returned row matches the name of the key EOS accounts derived from the user's supplied MPK. If so, it then performs a second check by doing L1 decryption on the L2-decrypted email address returned from the server, and only if the L2-decrypted email value matches the plaintext email address supplied by the user during login, is the login request considered to be successful by the client. Note that at this point the client is in receipt of L2-decrypted data, and only the originating MPK can perform the required remaining decryption in the client to arrive at plaintext values.
      
### Authentication - Updates (```/api/assets``` and ```/api/data```)

In contrast to the login authentication model (where data returned by the server remains L1-encrypted, and the client has has to complete the login by performing L1 decryption), the data-update methods are performed in their entirety by the server.

To prevent malicious invocations of these methods, they must be completely authenticated by the server before any request is made to the DSC to execute the updates. This is done by taking two parameters from the client:

  * ```req.body.e_email``` - the L1-encrypted email address of the user attempting login
  * ```req.body.owner``` - the owner of the EOS key account derived from the user's supplied MPK

Authentication for updates is done by the ```check_auth()``` function: it executes a lookup in the DSC by primary key (```req.body.owner```) and retreives (L1+L2)-encrypted data for the identified row. It then performs L2 encryption on the supplied L1-encrypted email address and checks that the resulting (L1+L2)-encrypted value matches the retrieved (L1+L2)-encrypted value of the row returned by the DSC. If so, it considers the update request to be authenticated and continues to execute the data updates, otherwise the client request is rejected.

## Threat Analysis

It should be evident from the foregoing, that brute force attacks on encrypted data (either in the DSC or in browser storage) are unlikely to succeed. But as with all cryptographic systems, there may exist potential attack vectors related to unauthorized access, or to the acquisition of decryption keys. We discuss some here in terms of their implementation difficulty, and mitigations that may be applied.
     
* **Malicious Browser Extension**
  * Risk: medium
  * Attack Difficulty: high
  * Mitigation: user awareness & [ULTRA_SEC](https://github.com/Scoop-Tech/scpx-wallet/issues/36)

  We regard this vector as the highest risk: all browsers support installation of extensions which may in turn inject content or script into pages. Injected content script has access to the content page's session Web Storage. For this reason, we do not by default persist the ```PATCH_H_MPK``` decryption key to Web Storage.

  A malicious extensions may also try to read this value from ```document.hjs_mpk```, and while extensions don't have access to content-page scoped variables, nonetheless a malicious extension might be able to break out of the default extension sandbox by injecting inline script into the content page. It should be noted that the technical complexity for an attacker to implement it is considerable (requiring custom enginerring of the attack script), and that there is some degree of due-diligence performed by extension store operators on what extensions they distribute. 
    
  But to remove this attack surface, a user option to never perist ```document.hjs_mpk``` is planned: https://github.com/Scoop-Tech/scpx-wallet/issues/36 and is high priority.
                
 * **Cross-site Scripting (XSS)**
   * Risk - very low
   * Attack Difficulty: high
   * Mitigation: N/A

   An XSS code injection attack would be at a similar difficulty level to a Malicious Browser Extension for a potential attacker, as it would require bespoke script to read application-specific data from Web Storage or from global scope JS vars. 
    
   We believe the risk of this attack is reduced to very low levels by a restrictive ```script-src``` set in ```Content-Security-Policy``` on the Web Wallet, meaning that we the browser only accepts executable script from known trusted sources.

* **Unattended Terminal**
   * Risk: low
   * Attack Difficulty: very low
   * Mitigation: Auto Logout & [2FA](https://github.com/Scoop-Tech/scpx-wallet/issues/35)

   The simplest form of attack, and therefore the most likely: if you leave the wallet logged in, anybody with physical access to the keyboard broadcast transactions from it. Therefore, user setting by default are to log out sessions after 10 minutes of idle time. This alone provides substantial protection compared to the alternative.

   Work to further improve this via 2FA is planned, and is high priority: https://github.com/Scoop-Tech/scpx-wallet/issues/35
    
 * **Compromised Terminal** (malicious root-elevation)
   * Risk: high
   * Attack Difficulty: high
   * Mitigation: end user security awareness
    
   An attacker who succeeds in gaining root access to a machine will have complete control and visibility of all actions and data on the device. This includes trivially installing a key-logging tool which could pattern-match and transmit any privkey-like or MPK-like keyboard strings.

   This vector is common to all self-sovereign wallets that cannot rely on a centralized service to authenticate or execute requests: when you are the bank, you really do need to care about security!
    
   Because Scoop MPK strings are very long, we might reasonably assume that users will save their MPKs in password managers rather than type them, so the specific risk of key-logging may be reduced. This would make the attacker's difficultly in making use of a rooted machine higher than otherwise. But a machine compromised by root-elevated malicious code is fundamentally beyond redemption from a security standpoint. 

