import autoBind from "auto-bind";

import { Component } from "@component";
import { WindowModalBlurEvent } from "@src/events/blur";
import { WindowModalFocusEvent } from "@src/events/focus";
import { WindowModalMinimizeEvent } from "@src/events/minimize";
import { WindowModalMoveEvent } from "@src/events/move";
import { WindowModalResizeEvent } from "@src/events/resize";
import { WindowModalUnminimizeEvent } from "@src/events/unminimize";
import { IPoint } from "@src/interfaces";
import { addPx, Point } from "@src/util";
import { Div } from "../div";
import { IWindowModalOptions } from "./interfaces";
import { MIN_WINDOW_SIZE, WindowResizeHandler } from "./resize-handler";
import { WindowBar } from "./window-bar";

export class WindowModal extends Component {

    public get mousePos() { return this._mousePos; }

    public get size() { return this._size; }
    public set size(size: IPoint) {
        if (size.x < MIN_WINDOW_SIZE || size.y < MIN_WINDOW_SIZE) {
            return;
        }
        if (!this.element.dispatchEvent(new WindowModalResizeEvent(this._size, size))) {
            return;
        }
        this._size = size;
        this.updateElement();
    }
    public get pos() { return this._pos; }
    public set pos(pos: IPoint) {
        if (!this.element.dispatchEvent(new WindowModalMoveEvent(this._pos, pos))) {
            return;
        }
        this._pos = pos;
        this.updateElement();
    }
    public get focused() { return this._focused; }
    public set focused(focused: boolean) {
        if (!this._focused && focused) {
            if (!this.element.dispatchEvent(new WindowModalFocusEvent())) {
                return;
            }
        } else if (this._focused && !focused) {
            if (!this.element.dispatchEvent(new WindowModalBlurEvent())) {
                return;
            }
        }
        this._focused = focused;
        this.updateElement();
    }
    public get resizable() { return this._resizable; }
    public set resizable(resizable: boolean) {
        this._resizable = resizable;
        this.updateElement();
    }
    public get movable() { return this._movable; }
    public set movable(movable: boolean) {
        this._movable = movable;
        this.updateElement();
    }
    public get title() { return this._title; }
    public set title(title: string) {
        this.windowBar.setTitle(title);
        this._title = title;
    }

    public get moving() { return this.windowBar.moving; }
    public get resizing() { return Boolean(this.resizeHandler.resizing); }
    public get minimized() { return this._minimized; }
    public get unminimized() { return !this._minimized; }

    protected content: Component;
    protected windowBar: WindowBar;
    protected resizeHandler: WindowResizeHandler;

    private _title: string;
    private _size: IPoint = { x: MIN_WINDOW_SIZE, y: MIN_WINDOW_SIZE };
    private _minimized: boolean = false;
    private _pos: IPoint = Point.zero;
    private _resizable: boolean = true;
    private _movable: boolean = true;
    private _focused: boolean = true;

    private _mousePos: IPoint = Point.zero;

    private _oldContentDisplay: string;

    constructor(options: IWindowModalOptions = {}) {
        super();
        autoBind(this);

        this._title = "";
        if (options.title) {
            if (typeof options.title !== "string") {
                throw new Error("Invalid elementSelector specified for window-modal: " + options.title);
            }
            this._title = options.title;
        }

        if (options.pos) {
            if (typeof options.pos !== "object") {
                throw new Error("Invalid pos specified for window-modal");
            }
            this._pos = options.pos;
        }

        if (options.size) {
            if (typeof options.size !== "object") {
                throw new Error("Invalid pos specified for window-modal");
            }
            this._size = options.size;
        }

        this.resizable = true;
        if (options.resizable === false) {
            this.resizable = false;
        }

        this.movable = true;
        if (options.movable === false) {
            this.resizable = false;
        }

        const { elementSelector } = options;
        let element: any;
        if (elementSelector) {
            if (typeof elementSelector !== "string") {
                throw new Error("Invalid elementSelector specified for window-modal: " + elementSelector);
            }
            this.content = null as any;
            element = this.hijackElement(elementSelector);
        } else {
            element = document.createElement("div");
            document.body.appendChild(element);
            this.content = new Div();
        }

        this.element = element;
        this.element.className = "WindowModal";
        this.resizeHandler = new WindowResizeHandler(this);

        this.windowBar = new WindowBar({ window: this, ...options });
        this.addChild(this.windowBar);

        this.content = this.content.withClassname("WindowModal-content");
        this.addChild(this.content);
        this._oldContentDisplay = this.content.element.style.display || "block";

        this.updateElement();

        window.addEventListener("mouseup", this.onMouseUp);
        window.addEventListener("mousemove", this.onMouseMove);
        window.addEventListener("select", this.onSelectStart);
        window.addEventListener("mouseenter", this.onMouseEnter);
    }

    public getWindowBar() {
        return this.windowBar;
    }

    public destroy() {
        window.removeEventListener("mouseup", this.onMouseUp);
        window.removeEventListener("mousemove", this.onMouseMove);
        window.removeEventListener("select", this.onSelectStart);
        window.removeEventListener("mouseenter", this.onMouseEnter);

        this.windowBar.destroy();
        document.body.removeChild(this.element);
        delete this.element;
        delete this.children;
    }

    public minimize() {
        if (this.minimized) {
            this.unminimize();
            return;
        }

        if (!this.element.dispatchEvent(new WindowModalMinimizeEvent())) {
            return;
        }

        this.setStyle({
            transition: "all 0.5s ease",
            width: "200px", height: "30px",
            left: "0px",
            top: "0px",
        });
        this._oldContentDisplay = this.content.element.style.display || "block";
        this.content.setStyle({
            display: "none",
        });
        this.windowBar.minimize();
        this._minimized = true;
        setTimeout(() => {
            this.setStyle({ height: "auto" });
        }, 500);
    }

    public unminimize(callback?: () => void) {
        if (!this.element.dispatchEvent(new WindowModalUnminimizeEvent())) {
            return;
        }

        this.setStyle({ bottom: null });
        this.content.setStyle({
            display: this._oldContentDisplay,
        });
        this.updateElement();
        this.windowBar.unminimize();
        this._minimized = false;
        setTimeout(() => {
            this.setStyle({ transition: "all 0.05s ease" });
            callback && callback();
        }, 600);
    }

    public clearMouseState() {
        this.resizeHandler.clearMouseState();
        this.windowBar.clearMouseState();
    }

    public updateElement() {
        const { pos, size, minimized } = this;
        if (minimized) {
            return;
        }
        this.setStyle({
            zIndex: this.focused ? "1" : "0",
            left: addPx(pos.x), top: addPx(pos.y),
            width: addPx(size.x), height: addPx(size.y),
        });
    }

    private onMouseEnter(event: any) {
        if (event.buttons === 0) {
            this.clearMouseState();
        }
    }

    private onMouseUp() {
        this.clearMouseState();
    }

    private onSelectStart(event: any) {
        if (this.resizing || this.moving) {
            event.preventDefault();
        }
    }

    private onMouseMove(event: any) {
        this._mousePos = { x: event.pageX, y: event.pageY };
        this.resizeHandler.onMouseMove(event);
        this.windowBar.onMouseMove(event);
    }

    private hijackElement(elementSelector: string): HTMLElement {
        const element = document.querySelector(elementSelector) as any;
        if (!element) {
            throw new Error("Could not find element for window. Selector: " + elementSelector);
        }

        if (element.parent) {
            element.remove();
        }

        const contentEle = element.cloneNode(true);
        const content = new Div([contentEle]);

        element.style = "";
        element.className = "";
        element.innerHTML = "";

        document.body.appendChild(element);
        this.content = content;
        return element;
    }

}
