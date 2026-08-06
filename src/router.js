/**
 * Simple hash-based SPA router
 */
export class Router {
  constructor() {
    this.routes = {};
    this.currentRoute = null;
    this.beforeEach = null;
    window.addEventListener('hashchange', () => this.resolve());
  }

  on(path, handler) {
    this.routes[path] = handler;
    return this;
  }

  guard(fn) {
    this.beforeEach = fn;
    return this;
  }

  navigate(path) {
    window.location.hash = path;
  }

  getCurrentRoute() {
    return window.location.hash.slice(1) || '/';
  }

  async resolve() {
    const path = this.getCurrentRoute();
    
    // Run guard
    if (this.beforeEach) {
      const allowed = await this.beforeEach(path);
      if (!allowed) return;
    }

    const handler = this.routes[path] || this.routes['/404'];
    if (handler) {
      this.currentRoute = path;
      await handler();
    }
  }

  start() {
    if (!window.location.hash) {
      window.location.hash = '/';
    }
    this.resolve();
  }
}

export const router = new Router();
