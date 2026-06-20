// =========================================================
// IoT Dashboard - Firebase Realtime Database
// Đọc dữ liệu từ node: sensor
// Ghi điều khiển vào node: control/gasLimit, control/tempLimit và control/ledWhite
// =========================================================

// ---------- 1) CẤU HÌNH FIREBASE ----------
var cauHinhFirebase = {
  apiKey: "",
  authDomain: "",
  databaseURL: "https://smartparking-d39a7-default-rtdb.asia-southeast1.firebasedatabase.app/",
  projectId: "smartparking-d39a7",
  storageBucket: "",
  messagingSenderId: "",
  appId: ""
};

// ---------- 2) BIẾN TOÀN CỤC ----------
var giaTriTruoc = {};
var bieuDo;
var demoTimer = null;
var firebaseRef = null;
var controlRef = null;
var db = null;

var gasLimit = 2000;
var tempLimit = 50;
var ledWhiteControl = 0;
var MUI_TEN_LEN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17 17 7M17 7H9M17 7v8"/></svg>';
var MUI_TEN_XUONG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M7 7l10 10M17 17H9M17 17V9"/></svg>';

function laySo(value, fallback) {
  var n = Number(value);
  return isNaN(n) ? fallback : n;
}

// ---------- 3) HÀM HIỂN THỊ 1 CẢM BIẾN ----------
function hienThi(ten, nhan, giaTri, max, nguong1, nguong2) {
  giaTri = laySo(giaTri, 0);
  var so = Math.round(giaTri * 10) / 10;

  var oVal = document.getElementById("val_" + ten);
  oVal.textContent = so;
  oVal.classList.remove("flash");
  void oVal.offsetWidth;
  oVal.classList.add("flash");
  document.getElementById("tval_" + ten).textContent = so;

  var phanTram = (giaTri / max) * 100;
  if (phanTram > 100) phanTram = 100;
  if (phanTram < 0) phanTram = 0;
  document.getElementById("gauge_" + ten).style.width = phanTram + "%";

  var loai = "ok";
  var chu = "An toàn";
  var mau = "#22c55e";

  if (nguong1 !== -1 && giaTri >= nguong2) {
    loai = "danger";
    chu = "Nguy hiểm";
    mau = "#ef4444";
  } else if (nguong1 !== -1 && giaTri >= nguong1) {
    loai = "warn";
    chu = "Cảnh báo";
    mau = "#f59e0b";
  }

  document.getElementById("gauge_" + ten).style.backgroundColor = mau;

  var badge = document.getElementById("badge_" + ten);
  badge.textContent = chu;
  badge.className = "badge " + loai;

  var card = badge.closest(".card");
  if (card) {
    card.classList.remove("card-warn", "card-danger");
    if (loai === "warn") card.classList.add("card-warn");
    if (loai === "danger") card.classList.add("card-danger");
  }

  var tbadge = document.getElementById("tbadge_" + ten);
  tbadge.textContent = chu;
  tbadge.className = "badge " + loai;
  document.getElementById("tdot_" + ten).style.backgroundColor = mau;

  hienXuHuong(ten, giaTri);
  giaTriTruoc[ten] = giaTri;
  return { loai: loai, nhan: nhan };
}

function hienXuHuong(ten, giaTri) {
  var oTrend = document.getElementById("trend_" + ten);
  var truoc = giaTriTruoc[ten];
  if (truoc === undefined) return;

  var chenhLech = Math.round(Math.abs(giaTri - truoc) * 10) / 10;
  if (giaTri > truoc) {
    oTrend.className = "card-trend up";
    oTrend.innerHTML = MUI_TEN_LEN + chenhLech;
  } else if (giaTri < truoc) {
    oTrend.className = "card-trend down";
    oTrend.innerHTML = MUI_TEN_XUONG + chenhLech;
  }
}

// ---------- 4) CẬP NHẬT TẤT CẢ ----------
function capNhat(nhietDo, doAm, anhSang, khiGas, statusTuESP32) {
  nhietDo = laySo(nhietDo, 0);
  doAm = laySo(doAm, 0);
  anhSang = laySo(anhSang, 0);
  khiGas = laySo(khiGas, 0);

  var tempWarn = tempLimit * 0.8;
  var gasWarn = gasLimit * 0.8;

  // Chỉ cảnh báo riêng trên từng ô theo ngưỡng đặt từ Firebase.
  // Không dùng banner cảnh báo chung phía trên.
  hienThi("nhietDo", "Nhiệt độ", nhietDo, 80, tempWarn, tempLimit);
  hienThi("doAm", "Độ ẩm", doAm, 100, -1, -1);
  hienThi("anhSang", "Ánh sáng", anhSang, 4095, -1, -1);
  hienThi("khiGas", "Khí gas", khiGas, 4095, gasWarn, gasLimit);

  var banner = document.getElementById("alertBanner");
  if (banner) banner.hidden = true;
  themVaoBieuDo(nhietDo, doAm, khiGas);
  document.getElementById("lastUpdate").textContent = "Cập nhật: " + new Date().toLocaleTimeString("vi-VN");

  var realLed = document.getElementById("ledWhiteRealState");
  if (realLed) {
    realLed.textContent = statusTuESP32 === "DANGER" ? "Theo hệ thống cảnh báo" : "Tự động/Thủ công";
  }
}

function capNhatCanhBao() {
  var banner = document.getElementById("alertBanner");
  if (banner) banner.hidden = true;
}

// ---------- 5) BIỂU ĐỒ ----------
function taoBieuDo() {
  var khung = document.getElementById("bieuDo");
  bieuDo = new Chart(khung, {
    type: "line",
    data: {
      labels: [],
      datasets: [
        { label: "Nhiệt độ", data: [], borderColor: "#fb7185", borderWidth: 2.5, tension: 0.4, pointRadius: 0 },
        { label: "Độ ẩm", data: [], borderColor: "#38bdf8", borderWidth: 2.5, tension: 0.4, pointRadius: 0 },
        { label: "Khí gas", data: [], borderColor: "#a78bfa", borderWidth: 2.5, tension: 0.4, pointRadius: 0 }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: "rgba(148,163,184,0.15)" }, ticks: { color: "#94a3b8", maxTicksLimit: 6 } },
        y: { grid: { color: "rgba(148,163,184,0.15)" }, ticks: { color: "#94a3b8" }, beginAtZero: true }
      }
    }
  });
}

function themVaoBieuDo(nhietDo, doAm, khiGas) {
  var gio = new Date().toLocaleTimeString("vi-VN");
  bieuDo.data.labels.push(gio);
  bieuDo.data.datasets[0].data.push(nhietDo);
  bieuDo.data.datasets[1].data.push(doAm);
  bieuDo.data.datasets[2].data.push(khiGas);

  if (bieuDo.data.labels.length > 30) {
    bieuDo.data.labels.shift();
    bieuDo.data.datasets[0].data.shift();
    bieuDo.data.datasets[1].data.shift();
    bieuDo.data.datasets[2].data.shift();
  }
  bieuDo.update();
}

function datKetNoi(trangThai, chu) {
  document.getElementById("connPill").setAttribute("data-state", trangThai);
  document.getElementById("connLabel").textContent = chu;
}

// ---------- 6) DEMO ----------
function soNgauNhien(min, max) {
  return Math.round(Math.random() * (max - min) + min);
}

function batDemo() {
  tatFirebase();
  datKetNoi("demo", "Chế độ Demo");
  document.getElementById("demoToggle").checked = true;
  if (demoTimer !== null) return;

  function motLan() {
    capNhat(soNgauNhien(25, 55), soNgauNhien(40, 90), soNgauNhien(100, 3500), soNgauNhien(800, 3000), "SAFE");
  }

  motLan();
  demoTimer = setInterval(motLan, 2000);
}

function tatDemo() {
  if (demoTimer !== null) {
    clearInterval(demoTimer);
    demoTimer = null;
  }
  document.getElementById("demoToggle").checked = false;
}

// ---------- 7) FIREBASE ----------
function chayFirebase() {
  tatDemo();

  if (firebase.apps.length === 0) {
    firebase.initializeApp(cauHinhFirebase);
  }

  db = firebase.database();

  db.ref(".info/connected").on("value", function (snap) {
    datKetNoi(snap.val() === true ? "online" : "offline", snap.val() === true ? "Trực tuyến" : "Mất kết nối");
  });

  // Đọc dữ liệu cảm biến đúng với code ESP32 của bạn: sensor.json
  firebaseRef = db.ref("sensor");
  firebaseRef.on("value", function (snap) {
    var data = snap.val();
    if (!data) return;

    capNhat(data.temperature, data.humidity, data.light, data.gas, data.status);
  });

  // Đọc ngưỡng điều khiển từ Firebase: control/gasLimit và control/tempLimit
  controlRef = db.ref("control");
  controlRef.on("value", function (snap) {
    var data = snap.val() || {};

    if (data.gasLimit !== undefined) gasLimit = Number(data.gasLimit);
    if (data.tempLimit !== undefined) tempLimit = Number(data.tempLimit);
    if (data.ledWhite !== undefined) ledWhiteControl = Number(data.ledWhite);

    document.getElementById("gasLimitInput").value = gasLimit;
    document.getElementById("tempLimitInput").value = tempLimit;
    document.getElementById("currentGasLimit").textContent = gasLimit;
    document.getElementById("currentTempLimit").textContent = tempLimit;

    var ledSwitch = document.getElementById("ledWhiteSwitch");
    var ledText = document.getElementById("ledWhiteText");
    var ledCurrent = document.getElementById("currentLedWhite");
    if (ledSwitch) ledSwitch.checked = ledWhiteControl === 1;
    if (ledText) ledText.textContent = ledWhiteControl === 1 ? "Bật thủ công" : "Tắt thủ công";
    if (ledCurrent) ledCurrent.textContent = ledWhiteControl === 1 ? "ON" : "OFF";
  });
}

function tatFirebase() {
  if (firebaseRef !== null) {
    firebaseRef.off();
    firebaseRef = null;
  }
  if (controlRef !== null) {
    controlRef.off();
    controlRef = null;
  }
}

function luuLedTrang() {
  var msg = document.getElementById("ledControlMessage");
  var ledSwitch = document.getElementById("ledWhiteSwitch");
  var ledMoi = ledSwitch.checked ? 1 : 0;

  if (!db) {
    msg.textContent = "Chưa kết nối Firebase.";
    msg.className = "control-message error";
    ledSwitch.checked = ledWhiteControl === 1;
    return;
  }

  db.ref("control").update({ ledWhite: ledMoi }).then(function () {
    ledWhiteControl = ledMoi;
    document.getElementById("ledWhiteText").textContent = ledMoi === 1 ? "Bật thủ công" : "Tắt thủ công";
    document.getElementById("currentLedWhite").textContent = ledMoi === 1 ? "ON" : "OFF";
    msg.textContent = "Đã cập nhật LED trắng lên Firebase.";
    msg.className = "control-message success";
  }).catch(function (err) {
    msg.textContent = "Lỗi cập nhật LED: " + err.message;
    msg.className = "control-message error";
    ledSwitch.checked = ledWhiteControl === 1;
  });
}

function luuNguong() {
  var gasMoi = Number(document.getElementById("gasLimitInput").value);
  var tempMoi = Number(document.getElementById("tempLimitInput").value);
  var msg = document.getElementById("controlMessage");

  if (isNaN(gasMoi) || gasMoi < 0 || gasMoi > 4095) {
    msg.textContent = "Ngưỡng gas phải nằm trong khoảng 0 - 4095.";
    msg.className = "control-message error";
    return;
  }

  if (isNaN(tempMoi) || tempMoi < 0 || tempMoi > 100) {
    msg.textContent = "Ngưỡng nhiệt độ phải nằm trong khoảng 0 - 100°C.";
    msg.className = "control-message error";
    return;
  }

  if (!db) {
    msg.textContent = "Chưa kết nối Firebase.";
    msg.className = "control-message error";
    return;
  }

  db.ref("control").update({
    gasLimit: gasMoi,
    tempLimit: tempMoi
  }).then(function () {
    msg.textContent = "Đã cập nhật ngưỡng lên Firebase.";
    msg.className = "control-message success";
  }).catch(function (err) {
    msg.textContent = "Lỗi cập nhật: " + err.message;
    msg.className = "control-message error";
  });
}

// ---------- 8) THEME + KHỞI ĐỘNG ----------
function doiTheme() {
  var hienTai = document.body.getAttribute("data-theme");
  var moi = hienTai === "dark" ? "light" : "dark";
  document.body.setAttribute("data-theme", moi);
  localStorage.setItem("iot-theme", moi);
}

function batTatDemo() {
  if (document.getElementById("demoToggle").checked === true) {
    batDemo();
  } else {
    tatDemo();
    if (cauHinhFirebase.databaseURL !== "") chayFirebase();
    else batDemo();
  }
}

window.onload = function () {
  var themeLuu = localStorage.getItem("iot-theme");
  if (themeLuu) document.body.setAttribute("data-theme", themeLuu);

  taoBieuDo();
  document.getElementById("themeToggle").onclick = doiTheme;
  document.getElementById("demoToggle").onchange = batTatDemo;
  document.getElementById("saveLimitsBtn").onclick = luuNguong;
  document.getElementById("ledWhiteSwitch").onchange = luuLedTrang;

  if (cauHinhFirebase.databaseURL !== "") chayFirebase();
  else batDemo();
};
