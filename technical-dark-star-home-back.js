(function () {
  var HOME = "aivault-home.html";
  var btn = document.getElementById("homeButton");
  if (btn) {
    btn.setAttribute("href", HOME);
    btn.addEventListener("click", function (e) {
      e.preventDefault();
      location.replace(HOME);
    });
  }
  if (!sessionStorage.getItem("aivault-ds-home-guard")) {
    sessionStorage.setItem("aivault-ds-home-guard", "1");
    history.replaceState({ aivaultHome: 1 }, "", location.href);
    history.pushState({ aivaultDarkStar: 1 }, "", location.href);
  }
  window.addEventListener("popstate", function () {
    location.replace(HOME);
  });
})();
