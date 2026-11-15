"use strict";
document.addEventListener("DOMContentLoaded", () => {
  const password = document.getElementById("registerPassword");
  const confirm = document.getElementById("registerConfirm");
  const hint = document.getElementById("passwordHint");
  const confirmHint = document.getElementById("confirmHint");
  function feedback() {
    const enough = password.value.length >= 10;
    hint.textContent = !password.value ? "Use pelo menos 10 caracteres." : enough
      ? "Comprimento mínimo atendido."
      : `Faltam ${10 - password.value.length} caracteres para o mínimo.`;
    hint.classList.toggle("requirement-met", enough);
    const mismatch = Boolean(confirm.value) && password.value !== confirm.value;
    confirm.setCustomValidity(mismatch ? "As senhas precisam ser iguais." : "");
    confirm.setAttribute("aria-invalid", String(mismatch));
    confirmHint.textContent = !confirm.value ? "Repita a senha escolhida." : mismatch
      ? "As senhas ainda não coincidem." : "As senhas coincidem.";
    confirmHint.classList.toggle("requirement-met", Boolean(confirm.value) && !mismatch);
  }
  password.addEventListener("input", feedback);
  confirm.addEventListener("input", feedback);
  document.getElementById("registerForm").addEventListener("reset", () => setTimeout(feedback, 0));
  document.querySelectorAll("[data-toggle-password]").forEach(button => {
    button.setAttribute("aria-pressed", "false");
    button.addEventListener("click", () => {
      const visible = document.getElementById(button.dataset.togglePassword).type === "text";
      button.setAttribute("aria-pressed", String(visible));
    });
  });
});
