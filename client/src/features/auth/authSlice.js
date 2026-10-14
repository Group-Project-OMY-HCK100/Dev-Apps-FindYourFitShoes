import { createSlice, nanoid } from "@reduxjs/toolkit";
import axios from "axios";
import baseUrl from "../../constants/baseUrl.js";

let storedToken = null;
try { storedToken = globalThis.sessionStorage?.getItem("access_token") || null; }
catch { /* A blocked browser storage starts with a guest session. */ }

const initialState = {
  user: null,
  token: storedToken,
  loading: Boolean(storedToken),
  error: "",
  submitting: false,
  formError: "",
  sessionRequestId: null,
  authRequestId: null,
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    sessionPending: (state, action) => {
      state.token = action.payload.token;
      state.loading = true;
      state.error = "";
      state.sessionRequestId = action.payload.requestId;
    },
    sessionSuccess: (state, action) => {
      if (state.sessionRequestId !== action.payload.requestId) return;
      state.user = action.payload.user;
      state.loading = false;
      state.error = "";
      state.sessionRequestId = null;
    },
    sessionFailed: (state, action) => {
      if (state.sessionRequestId !== action.payload.requestId) return;
      state.loading = false;
      state.error = action.payload.message;
      state.sessionRequestId = null;
    },
    sessionCancelled: (state, action) => {
      if (state.sessionRequestId !== action.payload) return;
      state.loading = false;
      state.sessionRequestId = null;
    },
    authPending: (state, action) => {
      state.submitting = true;
      state.formError = "";
      state.authRequestId = action.payload;
    },
    authSuccess: (state, action) => {
      if (state.authRequestId !== action.payload.requestId) return;
      state.user = action.payload.user;
      state.token = action.payload.token;
      state.loading = false;
      state.error = "";
      state.submitting = false;
      state.formError = "";
      state.authRequestId = null;
      state.sessionRequestId = null;
    },
    authFailed: (state, action) => {
      if (state.authRequestId !== action.payload.requestId) return;
      state.submitting = false;
      state.formError = action.payload.message;
      state.authRequestId = null;
    },
    authCancelled: (state, action) => {
      if (state.authRequestId !== action.payload) return;
      state.submitting = false;
      state.authRequestId = null;
    },
    clearFormError: (state) => { state.formError = ""; },
    sessionCleared: () => ({ ...initialState, user: null, token: null, loading: false }),
  },
});

export const {
  sessionPending, sessionSuccess, sessionFailed, sessionCancelled,
  authPending, authSuccess, authFailed, authCancelled, clearFormError, sessionCleared,
} = authSlice.actions;

// Side effects berada di thunk, seperti fetchAsync pada contoh Downloads/Redux.
export const logoutAsync = () => (dispatch) => {
  sessionStorage.removeItem("access_token");
  sessionStorage.removeItem("soleswap.session");
  dispatch(sessionCleared());
};

export const restoreSessionAsync = (signal) => async (dispatch, getState) => {
  const token = sessionStorage.getItem("access_token");
  if (!token) { dispatch(sessionCleared()); return; }
  const requestId = nanoid();
  dispatch(sessionPending({ token, requestId }));
  try {
    const { data } = await axios.get(`${baseUrl}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` }, signal, timeout: 15000,
    });
    if (signal?.aborted || getState().auth.sessionRequestId !== requestId) return;
    dispatch(sessionSuccess({ user: data.data, requestId }));
  } catch (error) {
    if (axios.isCancel(error) || signal?.aborted) {
      dispatch(sessionCancelled(requestId));
      return;
    }
    if (getState().auth.sessionRequestId !== requestId) return;
    if (error.response?.status === 401) dispatch(logoutAsync());
    else dispatch(sessionFailed({ requestId, message: error.response?.data?.error?.message || "Sesi belum bisa diperiksa. Pastikan server berjalan lalu coba lagi." }));
  }
};

const authenticateAsync = (path, body, signal) => async (dispatch, getState) => {
  if (getState().auth.submitting) return null;
  const requestId = nanoid();
  dispatch(authPending(requestId));
  try {
    const { data } = await axios.post(`${baseUrl}${path}`, body, { signal, timeout: 15000 });
    if (signal?.aborted || getState().auth.authRequestId !== requestId) {
      dispatch(authCancelled(requestId));
      return null;
    }
    sessionStorage.setItem("access_token", data.data.accessToken);
    sessionStorage.removeItem("soleswap.session");
    dispatch(authSuccess({ requestId, user: data.data.user, token: data.data.accessToken }));
    return data.data;
  } catch (error) {
    if (axios.isCancel(error) || signal?.aborted) {
      dispatch(authCancelled(requestId));
      return null;
    }
    const details = error.response?.data?.error?.details;
    dispatch(authFailed({ requestId, message: details?.length ? details.map((detail) => detail.message).join(". ") : error.response?.data?.error?.message || "Belum bisa terhubung ke server. Silakan coba lagi." }));
    return null;
  }
};

export const loginAsync = (body, signal) => authenticateAsync("/login", body, signal);
export const registerAsync = (body, signal) => authenticateAsync("/register", body, signal);
export default authSlice.reducer;
