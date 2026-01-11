document.querySelectorAll('.tab-btn').forEach(button => {
    button.addEventListener('click', () => {
      const tabName = button.getAttribute('data-tab');
      
      document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
      });
      
      document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
      });
      
      button.classList.add('active');
      document.getElementById(`${tabName}-tab`).classList.add('active');
      
      lucide.createIcons();
    });
  });