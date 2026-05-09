export const formatDate = (date, format = 'MMM DD, YYYY') => {
  if (!date) return 'N/A';
  const d = new Date(date);
  
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  const year = d.getFullYear();
  const month = months[d.getMonth()];
  const day = d.getDate().toString().padStart(2, '0');
  const hours = d.getHours().toString().padStart(2, '0');
  const minutes = d.getMinutes().toString().padStart(2, '0');
  const seconds = d.getSeconds().toString().padStart(2, '0');

  return format
    .replace('YYYY', year)
    .replace('MMM', month)
    .replace('MM', (d.getMonth() + 1).toString().padStart(2, '0'))
    .replace('DD', day)
    .replace('HH', hours)
    .replace('mm', minutes)
    .replace('ss', seconds);
};

export const formatDateTime = (date) => {
  return formatDate(date, 'MMM DD, YYYY HH:mm');
};

export const formatCurrency = (amount, currency = 'USD') => {
  if (!amount && amount !== 0) return 'N/A';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount);
};

export const formatNumber = (number) => {
  if (!number && number !== 0) return 'N/A';
  return new Intl.NumberFormat('en-US').format(number);
};

export const truncate = (str, length = 50) => {
  if (!str) return '';
  if (str.length <= length) return str;
  return str.substring(0, length) + '...';
};

export const getInitials = (firstName, lastName) => {
  return `${firstName?.charAt(0) || ''}${lastName?.charAt(0) || ''}`.toUpperCase();
};

export const getStatusBadgeColor = (status, statusMap) => {
  return statusMap[status] || 'default';
};