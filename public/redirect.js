if (!localStorage.getItem('jwt')) {
  window.location.href = '/login.html';
} else {
  window.location.href = '/dashboard.html';
}