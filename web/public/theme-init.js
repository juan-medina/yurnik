(function () {
  if (localStorage.getItem("theme") !== "light") {
    document.documentElement.classList.add("dark");
  }
})();
