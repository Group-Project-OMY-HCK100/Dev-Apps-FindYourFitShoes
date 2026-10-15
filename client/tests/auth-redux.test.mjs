import test from "node:test";
import assert from "node:assert/strict";
import { configureStore } from "@reduxjs/toolkit";
import axios from "axios";
import authReducer, { loginAsync, registerAsync, restoreSessionAsync, logoutAsync } from "../src/features/auth/authSlice.js";

Object.defineProperty(globalThis, "sessionStorage", { value: null, writable: true, configurable: true });

function setup(context) {
  const values = new Map();
  context.mock.property(globalThis, "sessionStorage", {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  });
  const store = configureStore({ reducer: { auth: authReducer } });
  return { store, values };
}
const user = { id: "account-1", name: "Raka", email: "raka@example.com" };
const body = { email: user.email, password: "password123" };
const response = { data: { success: true, data: { user, accessToken: "new-token" } } };

test("login and register preserve API payload and session storage", async (context) => {
  const { store, values } = setup(context);
  for (const [path, action, payload] of [["/login", loginAsync, body], ["/register", registerAsync, { ...body, name: user.name }]]) {
    context.mock.method(axios, "post", async (url, sent, options) => {
      assert.ok(url.endsWith(path));
      assert.deepEqual(sent, payload);
      assert.equal(options.timeout, 15000);
      return response;
    });
    const account = await store.dispatch(action(payload));
    assert.equal(account.accessToken, "new-token");
    assert.equal(values.get("access_token"), "new-token");
    assert.deepEqual(store.getState().auth.user, user);
    assert.equal(store.getState().auth.submitting, false);
    store.dispatch(logoutAsync());
    assert.equal(store.getState().auth.user, null);
    assert.equal(values.has("access_token"), false);
  }
});

test("invalid credentials and field validation leave the user as guest", async (context) => {
  const { store, values } = setup(context);
  context.mock.method(axios, "post", async () => {
    throw { response: { status: 401, data: { error: { message: "Email atau password salah" } } } };
  });
  assert.equal(await store.dispatch(loginAsync(body)), null);
  assert.equal(store.getState().auth.formError, "Email atau password salah");
  assert.equal(store.getState().auth.token, null);
  assert.equal(values.has("access_token"), false);
  context.mock.method(axios, "post", async () => {
    throw { response: { status: 422, data: { error: { details: [{ field: "name", message: "name harus 2–80 karakter" }] } } } };
  });
  await store.dispatch(registerAsync({ ...body, name: "R" }));
  assert.equal(store.getState().auth.formError, "name harus 2–80 karakter");
});

test("refresh restores the account with Bearer auth; expired token clears it", async (context) => {
  const { store, values } = setup(context);
  values.set("access_token", "saved-token");
  context.mock.method(axios, "get", async (url, options) => {
    assert.ok(url.endsWith("/auth/me"));
    assert.equal(options.headers.Authorization, "Bearer saved-token");
    return { data: { success: true, data: user } };
  });
  await store.dispatch(restoreSessionAsync());
  assert.equal(store.getState().auth.user.id, user.id);
  assert.equal(store.getState().auth.loading, false);
  context.mock.method(axios, "get", async () => { throw { response: { status: 401 } }; });
  await store.dispatch(restoreSessionAsync());
  assert.equal(store.getState().auth.token, null);
  assert.equal(store.getState().auth.user, null);
  assert.equal(values.has("access_token"), false);
});

test("network failure allows a session retry without deleting the saved token", async (context) => {
  const { store, values } = setup(context);
  values.set("access_token", "saved-token");
  context.mock.method(axios, "get", async () => { throw new Error("Network unavailable"); });
  await store.dispatch(restoreSessionAsync());
  assert.match(store.getState().auth.error, /Sesi belum bisa diperiksa/);
  assert.equal(values.get("access_token"), "saved-token");
  context.mock.method(axios, "get", async () => ({ data: { data: user } }));
  await store.dispatch(restoreSessionAsync());
  assert.equal(store.getState().auth.error, "");
  assert.equal(store.getState().auth.user.id, user.id);
});

test("an old profile response cannot replace a newer login or log it out", async (context) => {
  const { store, values } = setup(context);
  values.set("access_token", "old-token");
  let rejectOld;
  context.mock.method(axios, "get", () => new Promise((_resolve, reject) => { rejectOld = reject; }));
  const oldRequest = store.dispatch(restoreSessionAsync());
  context.mock.method(axios, "post", async () => response);
  await store.dispatch(loginAsync(body));
  rejectOld({ response: { status: 401 } });
  await oldRequest;
  assert.equal(store.getState().auth.token, "new-token");
  assert.equal(values.get("access_token"), "new-token");
});

test("logout while login is pending ignores the late success", async (context) => {
  const { store, values } = setup(context);
  let finish;
  context.mock.method(axios, "post", () => new Promise((resolve) => { finish = resolve; }));
  const pending = store.dispatch(loginAsync(body));
  assert.equal(store.getState().auth.submitting, true);
  store.dispatch(logoutAsync());
  finish(response);
  assert.equal(await pending, null);
  assert.equal(store.getState().auth.token, null);
  assert.equal(values.has("access_token"), false);
});

test("cancelled login does not persist a token, and double submit does not duplicate requests", async (context) => {
  const { store, values } = setup(context);
  let finish;
  const mocked = context.mock.method(axios, "post", () => new Promise((resolve) => { finish = resolve; }));
  const controller = new AbortController();
  const pending = store.dispatch(loginAsync(body, controller.signal));
  assert.equal(await store.dispatch(loginAsync(body)), null);
  assert.equal(mocked.mock.callCount(), 1);
  controller.abort();
  finish(response);
  assert.equal(await pending, null);
  assert.equal(values.has("access_token"), false);
  assert.equal(store.getState().auth.submitting, false);
});
