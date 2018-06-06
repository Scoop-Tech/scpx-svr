# https://code.visualstudio.com/tutorials/nodejs-deployment/getting-started

az webapp deployment user set --user-name <UserName> --password <Password>
scp_dom / (...88__**)

git deployment endpoint: https://scp_dom@scpx-svr.scm.azurewebsites.net/scpx-svr.git

push to azure git (deploy):
git push azure master

# tail prod logs: 
az webapp log tail --name scpx-svr

# browse prod:
az webapp browse --name scpx-svr

