@echo off
echo.
echo Apro la porta 4174 solo per la rete locale.
echo Se Windows chiede conferma, accetta come amministratore.
echo.
netsh advfirewall firewall add rule name="FootballIQ anteprima telefono" dir=in action=allow protocol=TCP localport=4174 remoteip=localsubnet profile=private,public
echo.
echo Fatto. Ora prova dal telefono:
echo http://192.168.1.3:4174/
echo.
pause
