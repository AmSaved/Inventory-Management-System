export const isValidEmail = (email) => {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
};

export const isValidPhone = (phone) => {
  const re = /^[+]?[(]?[0-9]{1,4}[)]?[-\s./0-9]*$/;
  return re.test(phone);
};

export const isValidEmployeeId = (id) => {
  const re = /^[A-Z0-9-]+$/;
  return re.test(id);
};

export const isValidPassword = (password) => {
  const re = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*#?&])[A-Za-z\d@$!%*#?&]{8,}$/;
  return re.test(password);
};