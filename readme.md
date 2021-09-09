# Scoop API Server
v0.11

RESTful node.js Express web server for the [Scoop Wallet](https://github.com/Scoop-Tech/scpx-wallet).

## API Methods

### Scoop Wallet Interface

  * ```/api/account``` (POST, rate-limited)
  * ```/api/login_v2``` (POST, authenticated, rate-limited) 
  * ```/api/assets``` (POST, authenticated, rate-limited) 
  * ```/api/data``` (POST, authenticated, rate-limited) 
  * ```/api/refer``` (POST, rate-limited) 
  * ```/api/ol``` (GET) returns a minimal packet for Scoop Wallet online check poller.
  * ```/api/ver``` (GET) returns API version info

### Dbg/Misc

  * ```/``` (GET) returns API runtime info: version, and SCPX EOS chain ID
  * ```/get_info``` (GET) returns raw ```nodeos``` SCPX EOS chain info
  * ```/api/top/:n``` (GET) returns top n rows from SCPX EOS data table
  * ```/api/single/:owner``` (GET) returns a single from SCPX EOS data table by primary key

## Security

  * CORS

    Allowed Origins for the Scoop Server are set at deployment host level (Microsoft Azure App Service), as it performs more reliably than equivalent settings in code. Equivalent code is in [app.js](./app.js) and is included when ```process.env.DEV==1``` for local development and testing.

  * Rate Limiting

    Restricted API endpoints are rate-limited by origin IP address by three separate limiters: ```generous_limiter``` and ```paranoid_limiter``` which both block requests when threshold request counts are exceeded, and also by ```speed_limiter``` which slows down requests when threshold request counts are exceeded.

  * Encryption
    
    The API performs symmetric cryptography on sensitive components of the inbound and outbound payloads. See [Scoop Security](https://github.com/Scoop-Tech/scpx-svr/blob/master/SECINFO.md) for details on the security and encryption model. 

## Building from Source

  * `nvm install v14.16.0`
  * PowerShell: `$env:DEV = 1` - required for CORS patching
  * Linux: `export DEV=1`
  * `npm start` or `nodemon`
  * see .\bin\www.js for config - default port is 3030

