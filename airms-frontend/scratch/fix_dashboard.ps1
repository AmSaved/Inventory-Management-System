$c = Get-Content 'c:\Users\User\Desktop\airms\airms-frontend\src\pages\DashboardPage.jsx'
$c[473] = '           </div>'
$n = $c[0..473] + $c[482..($c.Length-1)]
$n | Set-Content 'c:\Users\User\Desktop\airms\airms-frontend\src\pages\DashboardPage.jsx'
