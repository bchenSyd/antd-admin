/* global window */
/* global document */
/* global location */
import { routerRedux } from 'dva/router';
import { parse } from 'qs';
import config from 'config';
import { EnumRoleType } from 'enums';
import { query, logout } from 'services/app';
import * as menusService from 'services/menus';
import queryString from 'query-string';

const { prefix } = config;

export default {
  namespace: 'app',
  state: {
    user: {},
    permissions: {
      visit: [],
    },
    menu: [
      {
        id: 1,
        icon: 'laptop',
        name: 'Dashboard',
        router: '/dashboard',
      },
    ],
    menuPopoverVisible: false,
    siderFold: window.localStorage.getItem(`${prefix}siderFold`) === 'true',
    darkTheme: window.localStorage.getItem(`${prefix}darkTheme`) === 'true',
    isNavbar: document.body.clientWidth < 769,
    navOpenKeys: JSON.parse(window.localStorage.getItem(`${prefix}navOpenKeys`)) || [],
    locationPathname: '',
    locationQuery: {},
  },
  subscriptions: {

    setupHistory ({ dispatch, history }) {
      history.listen((location) => {
        dispatch({
          type: 'updateState',
          payload: {
            locationPathname: location.pathname,
            locationQuery: queryString.parse(location.search),
          },
        });
      });
    },

    setup ({ dispatch }) {
      dispatch({ type: 'query' });
      let tid;
      window.onresize = () => {
        clearTimeout(tid);
        tid = setTimeout(() => {
          dispatch({ type: 'changeNavbar' });
        }, 300);
      };
    },

  },
  effects: {
/*
  1.  Each function below returns a plain JavaScript object and does not perform any execution.
  2.  The execution is performed by the middleware during the Iteration process described above.
  3.  The middleware examines each Effect description and performs the appropriate action.
 */
    * query ({
      payload,
      // https://redux-saga.js.org/docs/api/
    }, { call /* call the function with args */, put /* dispatch action to store */, select /* getState */ }) {
      const { success, user } = yield call(query, payload);
      // returns the result of selector(getState(), ...args)
      const { locationPathname } = yield select(state => state.app); // see line 34, 44;

      // make a request to get current user (via cookie), if request succeeds, it means user is logged in (with a cookie)
      // otherwise direct current request to /login page;
      if (success && user) {
        // user already logged in (with cookie), `user` info retrieved; now populate the Menu according to perissions
        const { list } = yield call(menusService.query);
        const { permissions } = user;
        let menu = list;
        if (permissions.role === EnumRoleType.ADMIN || permissions.role === EnumRoleType.DEVELOPER) {
          permissions.visit = list.map(item => item.id);
        } else {
          menu = list.filter((item) => {
            const cases = [
              permissions.visit.includes(item.id),
              item.mpid ? permissions.visit.includes(item.mpid) || item.mpid === '-1' : true,
              item.bpid ? permissions.visit.includes(item.bpid) : true,
            ];
            // filter side menu list; only show menu items that user has permission on;
            return cases.every(_ => _);
          });
        }
        yield put({
          type: 'updateState',
          payload: {
            user,
            permissions,
            menu,
          },
        });
        // if a logged in user try to acess /login again, rediect to /dashboard page;
        if (location.pathname === '/login') { // eslint-disable-line no-restricted-globals
          yield put(routerRedux.push({
            pathname: '/dashboard',
          }));
        }
      } else if (config.openPages && config.openPages.indexOf(locationPathname) < 0) {
        // user is not logged in yet and is trying to access a prootected page ( config.openPages.indexOf(page2access) === -1)
        // redirect to login page;
        yield put(routerRedux.push({
          pathname: '/login',
          search: queryString.stringify({
            from: locationPathname,
          }),
        }));
      }
    },

    * logout ({
      payload,
    }, { call, put }) {
      const data = yield call(logout, parse(payload));
      if (data.success) {
        yield put({ type: 'query' });
      } else {
        throw (data);
      }
    },

    * changeNavbar (action, { put, select }) {
      const { app } = yield (select());
      const isNavbar = document.body.clientWidth < 769;
      if (isNavbar !== app.isNavbar) {
        yield put({ type: 'handleNavbar', payload: isNavbar });
      }
    },

  },
  reducers: {
    updateState (state, { payload }) {
      return {
        ...state,
        ...payload,
      };
    },

    switchSider (state) {
      window.localStorage.setItem(`${prefix}siderFold`, !state.siderFold);
      return {
        ...state,
        siderFold: !state.siderFold,
      };
    },

    switchTheme (state) {
      window.localStorage.setItem(`${prefix}darkTheme`, !state.darkTheme);
      return {
        ...state,
        darkTheme: !state.darkTheme,
      };
    },

    switchMenuPopver (state) {
      return {
        ...state,
        menuPopoverVisible: !state.menuPopoverVisible,
      };
    },

    handleNavbar (state, { payload }) {
      return {
        ...state,
        isNavbar: payload,
      };
    },

    handleNavOpenKeys (state, { payload: navOpenKeys }) {
      return {
        ...state,
        ...navOpenKeys,
      };
    },
  },
};
