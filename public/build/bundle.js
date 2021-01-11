
(function(l, r) { if (l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (window.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(window.document);
var app = (function () {
    'use strict';

    function noop() { }
    const identity = x => x;
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }

    const is_client = typeof window !== 'undefined';
    let now = is_client
        ? () => window.performance.now()
        : () => Date.now();
    let raf = is_client ? cb => requestAnimationFrame(cb) : noop;

    const tasks = new Set();
    function run_tasks(now) {
        tasks.forEach(task => {
            if (!task.c(now)) {
                tasks.delete(task);
                task.f();
            }
        });
        if (tasks.size !== 0)
            raf(run_tasks);
    }
    /**
     * Creates a new task that runs on each raf frame
     * until it returns a falsy value or is aborted
     */
    function loop(callback) {
        let task;
        if (tasks.size === 0)
            raf(run_tasks);
        return {
            promise: new Promise(fulfill => {
                tasks.add(task = { c: callback, f: fulfill });
            }),
            abort() {
                tasks.delete(task);
            }
        };
    }

    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function destroy_each(iterations, detaching) {
        for (let i = 0; i < iterations.length; i += 1) {
            if (iterations[i])
                iterations[i].d(detaching);
        }
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_style(node, key, value, important) {
        node.style.setProperty(key, value, important ? 'important' : '');
    }
    function toggle_class(element, name, toggle) {
        element.classList[toggle ? 'add' : 'remove'](name);
    }
    function custom_event(type, detail) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, false, false, detail);
        return e;
    }

    const active_docs = new Set();
    let active = 0;
    // https://github.com/darkskyapp/string-hash/blob/master/index.js
    function hash(str) {
        let hash = 5381;
        let i = str.length;
        while (i--)
            hash = ((hash << 5) - hash) ^ str.charCodeAt(i);
        return hash >>> 0;
    }
    function create_rule(node, a, b, duration, delay, ease, fn, uid = 0) {
        const step = 16.666 / duration;
        let keyframes = '{\n';
        for (let p = 0; p <= 1; p += step) {
            const t = a + (b - a) * ease(p);
            keyframes += p * 100 + `%{${fn(t, 1 - t)}}\n`;
        }
        const rule = keyframes + `100% {${fn(b, 1 - b)}}\n}`;
        const name = `__svelte_${hash(rule)}_${uid}`;
        const doc = node.ownerDocument;
        active_docs.add(doc);
        const stylesheet = doc.__svelte_stylesheet || (doc.__svelte_stylesheet = doc.head.appendChild(element('style')).sheet);
        const current_rules = doc.__svelte_rules || (doc.__svelte_rules = {});
        if (!current_rules[name]) {
            current_rules[name] = true;
            stylesheet.insertRule(`@keyframes ${name} ${rule}`, stylesheet.cssRules.length);
        }
        const animation = node.style.animation || '';
        node.style.animation = `${animation ? `${animation}, ` : ``}${name} ${duration}ms linear ${delay}ms 1 both`;
        active += 1;
        return name;
    }
    function delete_rule(node, name) {
        const previous = (node.style.animation || '').split(', ');
        const next = previous.filter(name
            ? anim => anim.indexOf(name) < 0 // remove specific animation
            : anim => anim.indexOf('__svelte') === -1 // remove all Svelte animations
        );
        const deleted = previous.length - next.length;
        if (deleted) {
            node.style.animation = next.join(', ');
            active -= deleted;
            if (!active)
                clear_rules();
        }
    }
    function clear_rules() {
        raf(() => {
            if (active)
                return;
            active_docs.forEach(doc => {
                const stylesheet = doc.__svelte_stylesheet;
                let i = stylesheet.cssRules.length;
                while (i--)
                    stylesheet.deleteRule(i);
                doc.__svelte_rules = {};
            });
            active_docs.clear();
        });
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    let flushing = false;
    const seen_callbacks = new Set();
    function flush() {
        if (flushing)
            return;
        flushing = true;
        do {
            // first, call beforeUpdate functions
            // and update components
            for (let i = 0; i < dirty_components.length; i += 1) {
                const component = dirty_components[i];
                set_current_component(component);
                update(component.$$);
            }
            dirty_components.length = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        flushing = false;
        seen_callbacks.clear();
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }

    let promise;
    function wait() {
        if (!promise) {
            promise = Promise.resolve();
            promise.then(() => {
                promise = null;
            });
        }
        return promise;
    }
    function dispatch(node, direction, kind) {
        node.dispatchEvent(custom_event(`${direction ? 'intro' : 'outro'}${kind}`));
    }
    const outroing = new Set();
    let outros;
    function group_outros() {
        outros = {
            r: 0,
            c: [],
            p: outros // parent group
        };
    }
    function check_outros() {
        if (!outros.r) {
            run_all(outros.c);
        }
        outros = outros.p;
    }
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function transition_out(block, local, detach, callback) {
        if (block && block.o) {
            if (outroing.has(block))
                return;
            outroing.add(block);
            outros.c.push(() => {
                outroing.delete(block);
                if (callback) {
                    if (detach)
                        block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
    }
    const null_transition = { duration: 0 };
    function create_in_transition(node, fn, params) {
        let config = fn(node, params);
        let running = false;
        let animation_name;
        let task;
        let uid = 0;
        function cleanup() {
            if (animation_name)
                delete_rule(node, animation_name);
        }
        function go() {
            const { delay = 0, duration = 300, easing = identity, tick = noop, css } = config || null_transition;
            if (css)
                animation_name = create_rule(node, 0, 1, duration, delay, easing, css, uid++);
            tick(0, 1);
            const start_time = now() + delay;
            const end_time = start_time + duration;
            if (task)
                task.abort();
            running = true;
            add_render_callback(() => dispatch(node, true, 'start'));
            task = loop(now => {
                if (running) {
                    if (now >= end_time) {
                        tick(1, 0);
                        dispatch(node, true, 'end');
                        cleanup();
                        return running = false;
                    }
                    if (now >= start_time) {
                        const t = easing((now - start_time) / duration);
                        tick(t, 1 - t);
                    }
                }
                return running;
            });
        }
        let started = false;
        return {
            start() {
                if (started)
                    return;
                delete_rule(node);
                if (is_function(config)) {
                    config = config();
                    wait().then(go);
                }
                else {
                    go();
                }
            },
            invalidate() {
                started = false;
            },
            end() {
                if (running) {
                    cleanup();
                    running = false;
                }
            }
        };
    }
    function create_bidirectional_transition(node, fn, params, intro) {
        let config = fn(node, params);
        let t = intro ? 0 : 1;
        let running_program = null;
        let pending_program = null;
        let animation_name = null;
        function clear_animation() {
            if (animation_name)
                delete_rule(node, animation_name);
        }
        function init(program, duration) {
            const d = program.b - t;
            duration *= Math.abs(d);
            return {
                a: t,
                b: program.b,
                d,
                duration,
                start: program.start,
                end: program.start + duration,
                group: program.group
            };
        }
        function go(b) {
            const { delay = 0, duration = 300, easing = identity, tick = noop, css } = config || null_transition;
            const program = {
                start: now() + delay,
                b
            };
            if (!b) {
                // @ts-ignore todo: improve typings
                program.group = outros;
                outros.r += 1;
            }
            if (running_program) {
                pending_program = program;
            }
            else {
                // if this is an intro, and there's a delay, we need to do
                // an initial tick and/or apply CSS animation immediately
                if (css) {
                    clear_animation();
                    animation_name = create_rule(node, t, b, duration, delay, easing, css);
                }
                if (b)
                    tick(0, 1);
                running_program = init(program, duration);
                add_render_callback(() => dispatch(node, b, 'start'));
                loop(now => {
                    if (pending_program && now > pending_program.start) {
                        running_program = init(pending_program, duration);
                        pending_program = null;
                        dispatch(node, running_program.b, 'start');
                        if (css) {
                            clear_animation();
                            animation_name = create_rule(node, t, running_program.b, running_program.duration, 0, easing, config.css);
                        }
                    }
                    if (running_program) {
                        if (now >= running_program.end) {
                            tick(t = running_program.b, 1 - t);
                            dispatch(node, running_program.b, 'end');
                            if (!pending_program) {
                                // we're done
                                if (running_program.b) {
                                    // intro — we can tidy up immediately
                                    clear_animation();
                                }
                                else {
                                    // outro — needs to be coordinated
                                    if (!--running_program.group.r)
                                        run_all(running_program.group.c);
                                }
                            }
                            running_program = null;
                        }
                        else if (now >= running_program.start) {
                            const p = now - running_program.start;
                            t = running_program.a + running_program.d * easing(p / running_program.duration);
                            tick(t, 1 - t);
                        }
                    }
                    return !!(running_program || pending_program);
                });
            }
        }
        return {
            run(b) {
                if (is_function(config)) {
                    wait().then(() => {
                        // @ts-ignore
                        config = config();
                        go(b);
                    });
                }
                else {
                    go(b);
                }
            },
            end() {
                clear_animation();
                running_program = pending_program = null;
            }
        };
    }

    const globals = (typeof window !== 'undefined'
        ? window
        : typeof globalThis !== 'undefined'
            ? globalThis
            : global);
    function create_component(block) {
        block && block.c();
    }
    function mount_component(component, target, anchor) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        // onMount happens before the initial afterUpdate
        add_render_callback(() => {
            const new_on_destroy = on_mount.map(run).filter(is_function);
            if (on_destroy) {
                on_destroy.push(...new_on_destroy);
            }
            else {
                // Edge case - component was destroyed immediately,
                // most likely as a result of a binding initialising
                run_all(new_on_destroy);
            }
            component.$$.on_mount = [];
        });
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const prop_values = options.props || {};
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            before_update: [],
            after_update: [],
            context: new Map(parent_component ? parent_component.$$.context : []),
            // everything else
            callbacks: blank_object(),
            dirty
        };
        let ready = false;
        $$.ctx = instance
            ? instance(component, prop_values, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if ($$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor);
            flush();
        }
        set_current_component(parent_component);
    }
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set() {
            // overridden by instance, if it has props
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.21.0' }, detail)));
    }
    function append_dev(target, node) {
        dispatch_dev("SvelteDOMInsert", { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev("SvelteDOMInsert", { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev("SvelteDOMRemove", { node });
        detach(node);
    }
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation) {
        const modifiers = options === true ? ["capture"] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        dispatch_dev("SvelteDOMAddEventListener", { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev("SvelteDOMRemoveEventListener", { node, event, handler, modifiers });
            dispose();
        };
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev("SvelteDOMRemoveAttribute", { node, attribute });
        else
            dispatch_dev("SvelteDOMSetAttribute", { node, attribute, value });
    }
    function set_data_dev(text, data) {
        data = '' + data;
        if (text.data === data)
            return;
        dispatch_dev("SvelteDOMSetData", { node: text, data });
        text.data = data;
    }
    function validate_each_argument(arg) {
        if (typeof arg !== 'string' && !(arg && typeof arg === 'object' && 'length' in arg)) {
            let msg = '{#each} only iterates over array-like objects.';
            if (typeof Symbol === 'function' && arg && Symbol.iterator in arg) {
                msg += ' You can use a spread to convert this iterable into an array.';
            }
            throw new Error(msg);
        }
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error(`'target' is a required option`);
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn(`Component was already destroyed`); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

    /* src\components\Navbar.svelte generated by Svelte v3.21.0 */

    const file = "src\\components\\Navbar.svelte";

    function create_fragment(ctx) {
    	let nav;
    	let a;
    	let img;
    	let img_src_value;

    	const block = {
    		c: function create() {
    			nav = element("nav");
    			a = element("a");
    			img = element("img");
    			if (img.src !== (img_src_value = "/icon.png")) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "width", "70");
    			attr_dev(img, "height", "70");
    			attr_dev(img, "class", "d-inline-block align-top");
    			attr_dev(img, "alt", "");
    			add_location(img, file, 6, 4, 118);
    			attr_dev(a, "class", "navbar-brand");
    			attr_dev(a, "href", "/");
    			add_location(a, file, 5, 2, 79);
    			attr_dev(nav, "class", "navbar navbar-expand-lg navbar-light svelte-1y2df97");
    			add_location(nav, file, 4, 0, 25);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, nav, anchor);
    			append_dev(nav, a);
    			append_dev(a, img);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(nav);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance($$self, $$props) {
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Navbar> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("Navbar", $$slots, []);
    	return [];
    }

    class Navbar extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Navbar",
    			options,
    			id: create_fragment.name
    		});
    	}
    }

    function cubicOut(t) {
        const f = t - 1.0;
        return f * f * f + 1.0;
    }

    function fly(node, { delay = 0, duration = 400, easing = cubicOut, x = 0, y = 0, opacity = 0 }) {
        const style = getComputedStyle(node);
        const target_opacity = +style.opacity;
        const transform = style.transform === 'none' ? '' : style.transform;
        const od = target_opacity * (1 - opacity);
        return {
            delay,
            duration,
            easing,
            css: (t, u) => `
			transform: ${transform} translate(${(1 - t) * x}px, ${(1 - t) * y}px);
			opacity: ${target_opacity - (od * u)}`
        };
    }
    function slide(node, { delay = 0, duration = 400, easing = cubicOut }) {
        const style = getComputedStyle(node);
        const opacity = +style.opacity;
        const height = parseFloat(style.height);
        const padding_top = parseFloat(style.paddingTop);
        const padding_bottom = parseFloat(style.paddingBottom);
        const margin_top = parseFloat(style.marginTop);
        const margin_bottom = parseFloat(style.marginBottom);
        const border_top_width = parseFloat(style.borderTopWidth);
        const border_bottom_width = parseFloat(style.borderBottomWidth);
        return {
            delay,
            duration,
            easing,
            css: t => `overflow: hidden;` +
                `opacity: ${Math.min(t * 20, 1) * opacity};` +
                `height: ${t * height}px;` +
                `padding-top: ${t * padding_top}px;` +
                `padding-bottom: ${t * padding_bottom}px;` +
                `margin-top: ${t * margin_top}px;` +
                `margin-bottom: ${t * margin_bottom}px;` +
                `border-top-width: ${t * border_top_width}px;` +
                `border-bottom-width: ${t * border_bottom_width}px;`
        };
    }
    function scale(node, { delay = 0, duration = 400, easing = cubicOut, start = 0, opacity = 0 }) {
        const style = getComputedStyle(node);
        const target_opacity = +style.opacity;
        const transform = style.transform === 'none' ? '' : style.transform;
        const sd = 1 - start;
        const od = target_opacity * (1 - opacity);
        return {
            delay,
            duration,
            easing,
            css: (_t, u) => `
			transform: ${transform} scale(${1 - (sd * u)});
			opacity: ${target_opacity - (od * u)}
		`
        };
    }

    /* src\components\Hero.svelte generated by Svelte v3.21.0 */

    const { Error: Error_1 } = globals;
    const file$1 = "src\\components\\Hero.svelte";

    // (186:8) {#if first}
    function create_if_block_4(ctx) {
    	let span;
    	let span_intro;

    	const block = {
    		c: function create() {
    			span = element("span");
    			span.textContent = "Hi, I’m Aus Gomez";
    			add_location(span, file$1, 186, 10, 3957);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, span, anchor);
    		},
    		i: function intro(local) {
    			if (!span_intro) {
    				add_render_callback(() => {
    					span_intro = create_in_transition(span, typewriter, {});
    					span_intro.start();
    				});
    			}
    		},
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(span);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_4.name,
    		type: "if",
    		source: "(186:8) {#if first}",
    		ctx
    	});

    	return block;
    }

    // (190:8) {#if second}
    function create_if_block_3(ctx) {
    	let span;
    	let span_intro;

    	const block = {
    		c: function create() {
    			span = element("span");
    			span.textContent = "Software Developer";
    			attr_dev(span, "class", "second svelte-9o8ivp");
    			add_location(span, file$1, 190, 10, 4066);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, span, anchor);
    		},
    		i: function intro(local) {
    			if (!span_intro) {
    				add_render_callback(() => {
    					span_intro = create_in_transition(span, typewriter, {});
    					span_intro.start();
    				});
    			}
    		},
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(span);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_3.name,
    		type: "if",
    		source: "(190:8) {#if second}",
    		ctx
    	});

    	return block;
    }

    // (195:8) {#if fifth}
    function create_if_block_2(ctx) {
    	let span;
    	let t_value = /*workList*/ ctx[6][/*pickWork*/ ctx[5]] + "." + "";
    	let t;
    	let span_transition;
    	let current;

    	const block = {
    		c: function create() {
    			span = element("span");
    			t = text(t_value);
    			add_location(span, file$1, 195, 10, 4199);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, span, anchor);
    			append_dev(span, t);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			if ((!current || dirty & /*pickWork*/ 32) && t_value !== (t_value = /*workList*/ ctx[6][/*pickWork*/ ctx[5]] + "." + "")) set_data_dev(t, t_value);
    		},
    		i: function intro(local) {
    			if (current) return;

    			add_render_callback(() => {
    				if (!span_transition) span_transition = create_bidirectional_transition(span, typewriter, {}, true);
    				span_transition.run(1);
    			});

    			current = true;
    		},
    		o: function outro(local) {
    			if (!span_transition) span_transition = create_bidirectional_transition(span, typewriter, {}, false);
    			span_transition.run(0);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(span);
    			if (detaching && span_transition) span_transition.end();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_2.name,
    		type: "if",
    		source: "(195:8) {#if fifth}",
    		ctx
    	});

    	return block;
    }

    // (198:8) {#if third}
    function create_if_block_1(ctx) {
    	let span;

    	const block = {
    		c: function create() {
    			span = element("span");
    			span.textContent = "|";
    			add_location(span, file$1, 198, 10, 4308);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, span, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(span);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1.name,
    		type: "if",
    		source: "(198:8) {#if third}",
    		ctx
    	});

    	return block;
    }

    // (204:4) {#if fourth}
    function create_if_block(ctx) {
    	let div;
    	let a0;
    	let span0;
    	let i0;
    	let t0;
    	let i1;
    	let t1;
    	let a1;
    	let span1;
    	let i2;
    	let t2;
    	let i3;
    	let t3;
    	let a2;
    	let span2;
    	let i4;
    	let t4;
    	let i5;
    	let t5;
    	let a3;
    	let span3;
    	let i6;
    	let t6;
    	let i7;
    	let div_intro;

    	const block = {
    		c: function create() {
    			div = element("div");
    			a0 = element("a");
    			span0 = element("span");
    			i0 = element("i");
    			t0 = space();
    			i1 = element("i");
    			t1 = space();
    			a1 = element("a");
    			span1 = element("span");
    			i2 = element("i");
    			t2 = space();
    			i3 = element("i");
    			t3 = space();
    			a2 = element("a");
    			span2 = element("span");
    			i4 = element("i");
    			t4 = space();
    			i5 = element("i");
    			t5 = space();
    			a3 = element("a");
    			span3 = element("span");
    			i6 = element("i");
    			t6 = space();
    			i7 = element("i");
    			attr_dev(i0, "class", "fas fa-circle fa-stack-2x");
    			set_style(i0, "color", "#1FA4B6");
    			add_location(i0, file$1, 210, 12, 4630);
    			attr_dev(i1, "class", "fab fa-linkedin fa-stack-1x fa-inverse");
    			add_location(i1, file$1, 211, 12, 4705);
    			attr_dev(span0, "class", "fa-stack fa-2x");
    			add_location(span0, file$1, 209, 10, 4587);
    			attr_dev(a0, "href", "https://www.linkedin.com/in/austreberto-gomez-a85822113/");
    			attr_dev(a0, "title", "Aus Linkedin");
    			attr_dev(a0, "target", "_blank");
    			attr_dev(a0, "class", "svelte-9o8ivp");
    			add_location(a0, file$1, 205, 8, 4438);
    			attr_dev(i2, "class", "fas fa-circle fa-stack-2x");
    			set_style(i2, "color", "black");
    			add_location(i2, file$1, 220, 12, 4966);
    			attr_dev(i3, "class", "fab fa-github fa-stack-1x fa-inverse");
    			add_location(i3, file$1, 221, 12, 5039);
    			attr_dev(span1, "class", "fa-stack fa-2x");
    			add_location(span1, file$1, 219, 10, 4923);
    			attr_dev(a1, "href", "https://github.com/Anstroy");
    			attr_dev(a1, "title", "Anstroy Github");
    			attr_dev(a1, "target", "_blank");
    			attr_dev(a1, "class", "svelte-9o8ivp");
    			add_location(a1, file$1, 215, 8, 4802);
    			attr_dev(i4, "class", "fas fa-circle fa-stack-2x");
    			set_style(i4, "color", "#F44D56");
    			add_location(i4, file$1, 230, 12, 5308);
    			attr_dev(i5, "class", "fab fa-instagram fa-stack-1x fa-inverse");
    			add_location(i5, file$1, 231, 12, 5383);
    			attr_dev(span2, "class", "fa-stack fa-2x");
    			add_location(span2, file$1, 229, 10, 5265);
    			attr_dev(a2, "href", "https://www.instagram.com/auscode.me/");
    			attr_dev(a2, "title", "Aus Instagram");
    			attr_dev(a2, "target", "_blank");
    			attr_dev(a2, "class", "svelte-9o8ivp");
    			add_location(a2, file$1, 225, 8, 5134);
    			attr_dev(i6, "class", "fas fa-circle fa-stack-2x");
    			set_style(i6, "color", "#1B1B32");
    			add_location(i6, file$1, 240, 12, 5657);
    			attr_dev(i7, "class", "fab fa-free-code-camp fa-stack-1x fa-inverse");
    			add_location(i7, file$1, 241, 12, 5732);
    			attr_dev(span3, "class", "fa-stack fa-2x");
    			add_location(span3, file$1, 239, 10, 5614);
    			attr_dev(a3, "href", "https://www.freecodecamp.org/anstroy");
    			attr_dev(a3, "title", "Aus FreeCodeCamp");
    			attr_dev(a3, "target", "_blank");
    			attr_dev(a3, "class", "svelte-9o8ivp");
    			add_location(a3, file$1, 235, 8, 5481);
    			attr_dev(div, "class", "links svelte-9o8ivp");
    			add_location(div, file$1, 204, 6, 4400);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, a0);
    			append_dev(a0, span0);
    			append_dev(span0, i0);
    			append_dev(span0, t0);
    			append_dev(span0, i1);
    			append_dev(div, t1);
    			append_dev(div, a1);
    			append_dev(a1, span1);
    			append_dev(span1, i2);
    			append_dev(span1, t2);
    			append_dev(span1, i3);
    			append_dev(div, t3);
    			append_dev(div, a2);
    			append_dev(a2, span2);
    			append_dev(span2, i4);
    			append_dev(span2, t4);
    			append_dev(span2, i5);
    			append_dev(div, t5);
    			append_dev(div, a3);
    			append_dev(a3, span3);
    			append_dev(span3, i6);
    			append_dev(span3, t6);
    			append_dev(span3, i7);
    		},
    		i: function intro(local) {
    			if (!div_intro) {
    				add_render_callback(() => {
    					div_intro = create_in_transition(div, scale, {});
    					div_intro.start();
    				});
    			}
    		},
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block.name,
    		type: "if",
    		source: "(204:4) {#if fourth}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$1(ctx) {
    	let div3;
    	let div0;
    	let img;
    	let img_src_value;
    	let t0;
    	let div2;
    	let div1;
    	let span;
    	let t2;
    	let h1;
    	let t3;
    	let br0;
    	let t4;
    	let t5;
    	let h2;
    	let t6;
    	let t7;
    	let br1;
    	let t8;
    	let current;
    	let if_block0 = /*first*/ ctx[0] && create_if_block_4(ctx);
    	let if_block1 = /*second*/ ctx[1] && create_if_block_3(ctx);
    	let if_block2 = /*fifth*/ ctx[4] && create_if_block_2(ctx);
    	let if_block3 = /*third*/ ctx[2] && create_if_block_1(ctx);
    	let if_block4 = /*fourth*/ ctx[3] && create_if_block(ctx);

    	const block = {
    		c: function create() {
    			div3 = element("div");
    			div0 = element("div");
    			img = element("img");
    			t0 = space();
    			div2 = element("div");
    			div1 = element("div");
    			span = element("span");
    			span.textContent = "Welcome to my Portfolio";
    			t2 = space();
    			h1 = element("h1");
    			if (if_block0) if_block0.c();
    			t3 = space();
    			br0 = element("br");
    			t4 = space();
    			if (if_block1) if_block1.c();
    			t5 = space();
    			h2 = element("h2");
    			if (if_block2) if_block2.c();
    			t6 = space();
    			if (if_block3) if_block3.c();
    			t7 = space();
    			br1 = element("br");
    			t8 = space();
    			if (if_block4) if_block4.c();
    			attr_dev(img, "width", "394");
    			attr_dev(img, "height", "394");
    			attr_dev(img, "class", "hero-image rounded-circle svelte-9o8ivp");
    			if (img.src !== (img_src_value = "/aus.jpg")) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "alt", "");
    			add_location(img, file$1, 172, 4, 3620);
    			attr_dev(div0, "class", "col-sm-12 col-lg-5 text-center");
    			add_location(div0, file$1, 171, 2, 3570);
    			attr_dev(span, "class", "heading svelte-9o8ivp");
    			add_location(span, file$1, 182, 6, 3844);
    			add_location(br0, file$1, 188, 8, 4026);
    			attr_dev(h1, "class", "title svelte-9o8ivp");
    			add_location(h1, file$1, 184, 6, 3906);
    			attr_dev(h2, "class", "svelte-9o8ivp");
    			add_location(h2, file$1, 193, 6, 4162);
    			attr_dev(div1, "class", "inner svelte-9o8ivp");
    			add_location(div1, file$1, 180, 4, 3815);
    			add_location(br1, file$1, 202, 4, 4368);
    			attr_dev(div2, "class", "col-sm-12 col-lg-7 mt_md--40 mt_sm--40");
    			add_location(div2, file$1, 179, 2, 3757);
    			attr_dev(div3, "class", "row align-items-center svelte-9o8ivp");
    			add_location(div3, file$1, 170, 0, 3530);
    		},
    		l: function claim(nodes) {
    			throw new Error_1("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div3, anchor);
    			append_dev(div3, div0);
    			append_dev(div0, img);
    			append_dev(div3, t0);
    			append_dev(div3, div2);
    			append_dev(div2, div1);
    			append_dev(div1, span);
    			append_dev(div1, t2);
    			append_dev(div1, h1);
    			if (if_block0) if_block0.m(h1, null);
    			append_dev(h1, t3);
    			append_dev(h1, br0);
    			append_dev(h1, t4);
    			if (if_block1) if_block1.m(h1, null);
    			append_dev(div1, t5);
    			append_dev(div1, h2);
    			if (if_block2) if_block2.m(h2, null);
    			append_dev(h2, t6);
    			if (if_block3) if_block3.m(h2, null);
    			append_dev(div2, t7);
    			append_dev(div2, br1);
    			append_dev(div2, t8);
    			if (if_block4) if_block4.m(div2, null);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if (/*first*/ ctx[0]) {
    				if (if_block0) {
    					if (dirty & /*first*/ 1) {
    						transition_in(if_block0, 1);
    					}
    				} else {
    					if_block0 = create_if_block_4(ctx);
    					if_block0.c();
    					transition_in(if_block0, 1);
    					if_block0.m(h1, t3);
    				}
    			} else if (if_block0) {
    				if_block0.d(1);
    				if_block0 = null;
    			}

    			if (/*second*/ ctx[1]) {
    				if (if_block1) {
    					if (dirty & /*second*/ 2) {
    						transition_in(if_block1, 1);
    					}
    				} else {
    					if_block1 = create_if_block_3(ctx);
    					if_block1.c();
    					transition_in(if_block1, 1);
    					if_block1.m(h1, null);
    				}
    			} else if (if_block1) {
    				if_block1.d(1);
    				if_block1 = null;
    			}

    			if (/*fifth*/ ctx[4]) {
    				if (if_block2) {
    					if_block2.p(ctx, dirty);

    					if (dirty & /*fifth*/ 16) {
    						transition_in(if_block2, 1);
    					}
    				} else {
    					if_block2 = create_if_block_2(ctx);
    					if_block2.c();
    					transition_in(if_block2, 1);
    					if_block2.m(h2, t6);
    				}
    			} else if (if_block2) {
    				group_outros();

    				transition_out(if_block2, 1, 1, () => {
    					if_block2 = null;
    				});

    				check_outros();
    			}

    			if (/*third*/ ctx[2]) {
    				if (if_block3) ; else {
    					if_block3 = create_if_block_1(ctx);
    					if_block3.c();
    					if_block3.m(h2, null);
    				}
    			} else if (if_block3) {
    				if_block3.d(1);
    				if_block3 = null;
    			}

    			if (/*fourth*/ ctx[3]) {
    				if (if_block4) {
    					if (dirty & /*fourth*/ 8) {
    						transition_in(if_block4, 1);
    					}
    				} else {
    					if_block4 = create_if_block(ctx);
    					if_block4.c();
    					transition_in(if_block4, 1);
    					if_block4.m(div2, null);
    				}
    			} else if (if_block4) {
    				if_block4.d(1);
    				if_block4 = null;
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block0);
    			transition_in(if_block1);
    			transition_in(if_block2);
    			transition_in(if_block4);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block2);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div3);
    			if (if_block0) if_block0.d();
    			if (if_block1) if_block1.d();
    			if (if_block2) if_block2.d();
    			if (if_block3) if_block3.d();
    			if (if_block4) if_block4.d();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$1.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function typewriter(node, { speed = 30 }) {
    	const valid = node.childNodes.length === 1 && node.childNodes[0].nodeType === Node.TEXT_NODE;

    	if (!valid) {
    		throw new Error(`This transition only works on elements with a single text node child`);
    	}

    	const text = node.textContent;
    	const duration = text.length * speed;

    	return {
    		duration,
    		tick: t => {
    			const i = ~~(text.length * t);
    			node.textContent = text.slice(0, i);
    		}
    	};
    }

    function instance$1($$self, $$props, $$invalidate) {
    	let first = false;
    	let second = false;
    	let third = false;
    	let fourth = false;
    	let fifth = false;
    	setTimeout(() => $$invalidate(0, first = true), 500);
    	setTimeout(() => $$invalidate(1, second = true), 1200);
    	setTimeout(() => $$invalidate(2, third = true), 2200);
    	setTimeout(() => $$invalidate(3, fourth = true), 1700);

    	const workList = [
    		"coding remotely",
    		"are you reading this? 🤔",
    		"coding from 🏠",
    		"working around the 🌐",
    		"learning something cool",
    		"working hard 💪",
    		"coding on Github",
    		"I like Docker a lot! 🐋",
    		"coding from anywhere",
    		"fixing some bugs on my code 😵",
    		"learning more JS 🤓",
    		"coding cool stuff",
    		"check out my projects 👇",
    		"wearing a 😷",
    		"doing some hackathons 🏆",
    		"let me = 'add you'",
    		"did I say that already?"
    	];

    	let pickWork = 0;
    	setTimeout(() => loop(), 2000);

    	let loop = () => setTimeout(
    		() => {
    			$$invalidate(4, fifth = !fifth);
    			$$invalidate(5, pickWork = 0);
    			let x = Math.floor(Math.random() * Math.floor(workList.length - 1));

    			while (x !== pickWork) {
    				$$invalidate(5, pickWork = x);
    			}

    			loop();
    		},
    		1600
    	);

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Hero> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("Hero", $$slots, []);

    	$$self.$capture_state = () => ({
    		scale,
    		slide,
    		fly,
    		first,
    		second,
    		third,
    		fourth,
    		fifth,
    		workList,
    		pickWork,
    		loop,
    		typewriter
    	});

    	$$self.$inject_state = $$props => {
    		if ("first" in $$props) $$invalidate(0, first = $$props.first);
    		if ("second" in $$props) $$invalidate(1, second = $$props.second);
    		if ("third" in $$props) $$invalidate(2, third = $$props.third);
    		if ("fourth" in $$props) $$invalidate(3, fourth = $$props.fourth);
    		if ("fifth" in $$props) $$invalidate(4, fifth = $$props.fifth);
    		if ("pickWork" in $$props) $$invalidate(5, pickWork = $$props.pickWork);
    		if ("loop" in $$props) loop = $$props.loop;
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [first, second, third, fourth, fifth, pickWork, workList];
    }

    class Hero extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$1, create_fragment$1, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Hero",
    			options,
    			id: create_fragment$1.name
    		});
    	}
    }

    /* src\components\Footer.svelte generated by Svelte v3.21.0 */

    const file$2 = "src\\components\\Footer.svelte";

    function create_fragment$2(ctx) {
    	let div;
    	let p;
    	let t2;
    	let a0;
    	let i0;
    	let t3;
    	let a1;
    	let i1;
    	let t4;
    	let a2;
    	let i2;
    	let t5;
    	let a3;
    	let img;
    	let img_src_value;

    	const block = {
    		c: function create() {
    			div = element("div");
    			p = element("p");
    			p.textContent = `© Austreberto Gomez ${new Date().getFullYear()}`;
    			t2 = space();
    			a0 = element("a");
    			i0 = element("i");
    			t3 = space();
    			a1 = element("a");
    			i1 = element("i");
    			t4 = space();
    			a2 = element("a");
    			i2 = element("i");
    			t5 = space();
    			a3 = element("a");
    			img = element("img");
    			add_location(p, file$2, 1, 4, 26);
    			attr_dev(i0, "class", "fab fa-linkedin fa-2x");
    			add_location(i0, file$2, 2, 108, 194);
    			attr_dev(a0, "href", "https://www.linkedin.com/in/austreberto-gomez-a85822113/");
    			attr_dev(a0, "title", "Aus Linkedin");
    			attr_dev(a0, "target", "_blank");
    			attr_dev(a0, "class", "svelte-14g7cf7");
    			add_location(a0, file$2, 2, 4, 90);
    			attr_dev(i1, "class", "fab fa-github fa-2x");
    			add_location(i1, file$2, 3, 80, 317);
    			attr_dev(a1, "href", "https://github.com/Anstroy");
    			attr_dev(a1, "title", "Anstroy Github");
    			attr_dev(a1, "target", "_blank");
    			attr_dev(a1, "class", "svelte-14g7cf7");
    			add_location(a1, file$2, 3, 4, 241);
    			attr_dev(i2, "class", "fab fa-instagram fa-2x");
    			add_location(i2, file$2, 4, 90, 448);
    			attr_dev(a2, "href", "https://www.instagram.com/auscode.me/");
    			attr_dev(a2, "title", "Aus Instagram");
    			attr_dev(a2, "target", "_blank");
    			attr_dev(a2, "class", "svelte-14g7cf7");
    			add_location(a2, file$2, 4, 4, 362);
    			attr_dev(img, "width", "30px");
    			if (img.src !== (img_src_value = "/icons/codewars.png")) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "alt", "");
    			attr_dev(img, "class", "svelte-14g7cf7");
    			add_location(img, file$2, 5, 93, 585);
    			attr_dev(a3, "href", "https://www.codewars.com/r/9EJmXg");
    			attr_dev(a3, "title", "Join me on Codewars!");
    			attr_dev(a3, "target", "_blank");
    			attr_dev(a3, "class", "svelte-14g7cf7");
    			add_location(a3, file$2, 5, 4, 496);
    			attr_dev(div, "class", "footer svelte-14g7cf7");
    			add_location(div, file$2, 0, 0, 0);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, p);
    			append_dev(div, t2);
    			append_dev(div, a0);
    			append_dev(a0, i0);
    			append_dev(div, t3);
    			append_dev(div, a1);
    			append_dev(a1, i1);
    			append_dev(div, t4);
    			append_dev(div, a2);
    			append_dev(a2, i2);
    			append_dev(div, t5);
    			append_dev(div, a3);
    			append_dev(a3, img);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$2.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$2($$self, $$props) {
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Footer> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("Footer", $$slots, []);
    	return [];
    }

    class Footer extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$2, create_fragment$2, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Footer",
    			options,
    			id: create_fragment$2.name
    		});
    	}
    }

    /* src\components\Intro.svelte generated by Svelte v3.21.0 */

    const file$3 = "src\\components\\Intro.svelte";

    function create_fragment$3(ctx) {
    	let div1;
    	let h1;
    	let t1;
    	let div0;
    	let iframe;
    	let iframe_src_value;

    	const block = {
    		c: function create() {
    			div1 = element("div");
    			h1 = element("h1");
    			h1.textContent = "Who I am";
    			t1 = space();
    			div0 = element("div");
    			iframe = element("iframe");
    			add_location(h1, file$3, 5, 2, 70);
    			attr_dev(iframe, "class", "embed-responsive-item");
    			attr_dev(iframe, "width", "560");
    			attr_dev(iframe, "height", "315");
    			if (iframe.src !== (iframe_src_value = "https://www.youtube.com/embed/yzm_ZeNnGGk")) attr_dev(iframe, "src", iframe_src_value);
    			attr_dev(iframe, "frameborder", "0");
    			attr_dev(iframe, "allow", "accelerometer; autoplay; encrypted-media; gyroscope;\r\n        picture-in-picture");
    			iframe.allowFullscreen = true;
    			add_location(iframe, file$3, 7, 4, 149);
    			attr_dev(div0, "class", "embed-responsive embed-responsive-1by1");
    			add_location(div0, file$3, 6, 2, 91);
    			attr_dev(div1, "class", "container text-center video svelte-1eg8w5c");
    			add_location(div1, file$3, 4, 0, 25);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div1, anchor);
    			append_dev(div1, h1);
    			append_dev(div1, t1);
    			append_dev(div1, div0);
    			append_dev(div0, iframe);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div1);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$3.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$3($$self, $$props) {
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Intro> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("Intro", $$slots, []);
    	return [];
    }

    class Intro extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$3, create_fragment$3, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Intro",
    			options,
    			id: create_fragment$3.name
    		});
    	}
    }

    const projects = [
        {
            id: "Alacena",
            title: "Alacena Web Recipe Builder",
            desc:
                `This app will help you to find recipes with what you have at your fridge or "alacena"  (cupboard in Spanish). No download or annoying ads, just open the link with your phone, and you will be ready to start. Give it a try, it is totally free.`,
            latest: true,
            category: "web",
            tags: ["vue", "node", "tailwindcss"],
            source: "https://github.com/Anstroy/alacena-vue-3",
            live: "https://alacena-e3ywj.ondigitalocean.app/"
        },
        {
            id: "Countries-App",
            title: "Vue + Supabase",
            desc:
                "This small app, combines the power of Vue.js with Auth, CRUD operations, everything backed by Supabase as a backend.",
            latest: true,
            category: "web",
            tags: ["vue", "node", "supabase", "tailwindcss"],
            source: "https://github.com/Anstroy/countries-supabase",
            live: "https://vue-crud-supabase.netlify.app/"
        },
        {
            id: "Instagram-Bot",
            title: "Instagram Bot",
            desc:
                "Instragram bot that allows different things like uploading photos, fetching a list of photos from certain hashtags, etc",
            latest: true,
            category: "other",
            tags: ["python", "selenium"],
            source: "https://github.com/Anstroy/instabot",
            live: "https://share.getcloudapp.com/jkuYlzbK"
        },
        {
            id: "Chalkbyte",
            title: "Chalkbyte Schools",
            desc:
                "Chalkbyte is a company in Mexico that provides school online services at a low cost to combat COVID-19 lockdowns, I use Docker and NGINX to provide Moodle stacks to different schools.",
            latest: false,
            category: "web",
            tags: ["docker", "nginx"],
            source: "https://github.com/Anstroy/Chalkbyte",
            live: "https://chalkbyte.herokuapp.com/"
        },
        {
            id: "Office-Reservation",
            title: "Office Reservation App",
            desc:
                "This web app is very similar to Airbnb, but it was made to reserve office spaces within a company. I made this project in collaboration with other web developers on GitHub for a Hackathon in Mexico",
            latest: false,
            category: "web",
            tags: ["vue", "node", "vuetify", "firebase"],
            source: "https://github.com/Anstroy/office-reservation",
            live: "https://office-reservation.web.app/"
        },
        {
            id: "Web-3D-Maps",
            title: "Web 3D Maps",
            desc:
                "A web app to help people find their buildings around certain area. Like for example a university or city",
            latest: false,
            category: "web",
            tags: ["vue", "node", "vuetify", "mapbox"],
            source: "",
            live: "https://mapboxvue.firebaseapp.com/"
        },

        {
            id: "Habanero-App",
            title: "Habanero App",
            desc:
                "This is an open-source Flutter app that I developed to suggest food recipes based on the ingredients that the user already have",
            latest: false,
            category: "mobile",
            tags: ["flutter", "android", "ios", "firebase"],
            source: "https://github.com/Anstroy/recipe_app_flutter",
            live: "https://share.getcloudapp.com/nOuD9DBO"
        },

        {
            id: "Svelte-Portfolio",
            title: "Svelte Portfolio",
            desc:
                "A portolio template made with Svelte, this website exact website is the project",
            latest: false,
            category: "web",
            tags: ["svelte", "bootstrap"],
            source: "https://github.com/Anstroy/svelte_portfolio",
            live: "https://anstroy.github.io"
        },

        {
            id: "Ketogram",
            title: "Ketogram",
            desc:
                "Simply send a photo of your favorite food to this phone number (956) 403-6287 and you will receive information about that food being keto friendly or not.",
            latest: false,
            category: "mobile",
            tags: ["python", "flask", "twilio"],
            source: "https://github.com/Anstroy/ketogram",
            live: ""
        },

        {
            id: "Clienthub",
            title: "Clienthub",
            desc:
                "This is one of my very first medium-sized Ruby on Rails projects. It was developed for a company that needed a solution to keep a track of their clients personal information. It also includes file upload/download. The source code is NOT on github I have it on my personal private Bitbucket.",
            latest: false,
            category: "web",
            tags: ["rails", "bootstrap", "postgresql"],
            source: "",
            live: "https://clienthub.herokuapp.com/"
        },

        {
            id: "Veterinary-App",
            title: "Veterinary App",
            desc: `This is a platform built for a Veterinary company in Mexico, it's goal was to have a track of the customers and their pets.`,
            latest: false,
            category: "web",
            tags: ["rails", "bootstrap", "postgresql"],
            source: "",
            live: "https://vetapp19.herokuapp.com/en/"
        },

        {
            id: "Chat-Room",
            title: "Chat Room",
            desc:
                "This project was created using Vue.js + Firebase as backend, it allows any person to enter to a global chatroom using a desired nickname",
            latest: false,
            category: "web",
            tags: ["vue", "node", "firebase"],
            source: "https://github.com/Anstroy/ninja-chat-vue-cli",
            live: "https://ninja-chat-d3150.web.app/"
        },

        {
            id: "Grading-Mini-App",
            title: "Grading Mini App",
            desc: "Basic school grading app, made using only VUE.js and nothing else",
            latest: false,
            category: "web",
            tags: ["vue", "node", "firebase"],
            source: "https://github.com/Anstroy/grading_app",
            live: "https://grading-aus.firebaseapp.com/"
        }
    ];

    /* src\components\Projects.svelte generated by Svelte v3.21.0 */

    const { console: console_1 } = globals;
    const file$4 = "src\\components\\Projects.svelte";

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[9] = list[i];
    	child_ctx[11] = i;
    	return child_ctx;
    }

    function get_each_context_2(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[9] = list[i];
    	child_ctx[11] = i;
    	return child_ctx;
    }

    function get_each_context_1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[12] = list[i];
    	child_ctx[11] = i;
    	return child_ctx;
    }

    // (127:6) {#if project.latest}
    function create_if_block_2$1(ctx) {
    	let span;
    	let span_intro;

    	const block = {
    		c: function create() {
    			span = element("span");
    			span.textContent = "Latest";
    			attr_dev(span, "class", "badge badge-pill latest svelte-po4bhc");
    			add_location(span, file$4, 127, 8, 2758);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, span, anchor);
    		},
    		i: function intro(local) {
    			if (!span_intro) {
    				add_render_callback(() => {
    					span_intro = create_in_transition(span, slide, {});
    					span_intro.start();
    				});
    			}
    		},
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(span);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_2$1.name,
    		type: "if",
    		source: "(127:6) {#if project.latest}",
    		ctx
    	});

    	return block;
    }

    // (154:16) {#each project.tags as tag, i}
    function create_each_block_2(ctx) {
    	let img;
    	let img_src_value;
    	let t;

    	const block = {
    		c: function create() {
    			img = element("img");
    			t = text("\r\n                    ");
    			if (img.src !== (img_src_value = "/icons/" + /*tag*/ ctx[9] + ".png")) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "alt", "");
    			attr_dev(img, "class", "image");
    			attr_dev(img, "width", "30px");
    			add_location(img, file$4, 154, 18, 3660);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, img, anchor);
    			insert_dev(target, t, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*filteredProjects*/ 2 && img.src !== (img_src_value = "/icons/" + /*tag*/ ctx[9] + ".png")) {
    				attr_dev(img, "src", img_src_value);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(img);
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block_2.name,
    		type: "each",
    		source: "(154:16) {#each project.tags as tag, i}",
    		ctx
    	});

    	return block;
    }

    // (123:2) {#each filteredProjects as project, i}
    function create_each_block_1(ctx) {
    	let div5;
    	let t0;
    	let a;
    	let div4;
    	let div1;
    	let div0;
    	let img;
    	let img_src_value;
    	let img_alt_value;
    	let t1;
    	let div3;
    	let p0;
    	let t2;
    	let div2;
    	let h4;
    	let t3_value = /*project*/ ctx[12].title + "";
    	let t3;
    	let t4;
    	let p1;
    	let t5;
    	let div5_transition;
    	let current;
    	let dispose;
    	let if_block = /*project*/ ctx[12].latest && create_if_block_2$1(ctx);
    	let each_value_2 = /*project*/ ctx[12].tags;
    	validate_each_argument(each_value_2);
    	let each_blocks = [];

    	for (let i = 0; i < each_value_2.length; i += 1) {
    		each_blocks[i] = create_each_block_2(get_each_context_2(ctx, each_value_2, i));
    	}

    	function click_handler_4(...args) {
    		return /*click_handler_4*/ ctx[8](/*project*/ ctx[12], ...args);
    	}

    	const block = {
    		c: function create() {
    			div5 = element("div");
    			if (if_block) if_block.c();
    			t0 = space();
    			a = element("a");
    			div4 = element("div");
    			div1 = element("div");
    			div0 = element("div");
    			img = element("img");
    			t1 = space();
    			div3 = element("div");
    			p0 = element("p");
    			t2 = space();
    			div2 = element("div");
    			h4 = element("h4");
    			t3 = text(t3_value);
    			t4 = space();
    			p1 = element("p");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t5 = space();
    			attr_dev(img, "class", "img-fluid");
    			if (img.src !== (img_src_value = "/projects/" + /*project*/ ctx[12].id + ".jpg")) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "alt", img_alt_value = /*project*/ ctx[12].id);
    			attr_dev(img, "width", "auto");
    			attr_dev(img, "height", "200");
    			add_location(img, file$4, 140, 14, 3224);
    			attr_dev(div0, "class", "thumbnail");
    			add_location(div0, file$4, 139, 12, 3185);
    			attr_dev(div1, "class", "thumbnail-inner");
    			add_location(div1, file$4, 138, 10, 3142);
    			add_location(p0, file$4, 149, 12, 3495);
    			add_location(h4, file$4, 151, 14, 3549);
    			add_location(p1, file$4, 152, 14, 3589);
    			attr_dev(div2, "class", "inner");
    			add_location(div2, file$4, 150, 12, 3514);
    			attr_dev(div3, "class", "content");
    			add_location(div3, file$4, 148, 10, 3460);
    			attr_dev(div4, "class", "portfolio-static");
    			add_location(div4, file$4, 137, 8, 3100);
    			attr_dev(a, "href", "#");
    			attr_dev(a, "data-toggle", "modal");
    			attr_dev(a, "data-target", "#singleProjectModal");
    			attr_dev(a, "class", "item-portfolio-static gallery masonry_item portfolio-33-33 cat--1 svelte-po4bhc");
    			add_location(a, file$4, 129, 6, 2839);
    			attr_dev(div5, "class", "col-xs-6 col-sm-6 col-md-4 col-lg-3 card-div text-center svelte-po4bhc");
    			add_location(div5, file$4, 123, 4, 2619);
    		},
    		m: function mount(target, anchor, remount) {
    			insert_dev(target, div5, anchor);
    			if (if_block) if_block.m(div5, null);
    			append_dev(div5, t0);
    			append_dev(div5, a);
    			append_dev(a, div4);
    			append_dev(div4, div1);
    			append_dev(div1, div0);
    			append_dev(div0, img);
    			append_dev(div4, t1);
    			append_dev(div4, div3);
    			append_dev(div3, p0);
    			append_dev(div3, t2);
    			append_dev(div3, div2);
    			append_dev(div2, h4);
    			append_dev(h4, t3);
    			append_dev(div2, t4);
    			append_dev(div2, p1);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(p1, null);
    			}

    			append_dev(div5, t5);
    			current = true;
    			if (remount) dispose();
    			dispose = listen_dev(a, "click", click_handler_4, false, false, false);
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;

    			if (/*project*/ ctx[12].latest) {
    				if (if_block) {
    					if (dirty & /*filteredProjects*/ 2) {
    						transition_in(if_block, 1);
    					}
    				} else {
    					if_block = create_if_block_2$1(ctx);
    					if_block.c();
    					transition_in(if_block, 1);
    					if_block.m(div5, t0);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}

    			if (!current || dirty & /*filteredProjects*/ 2 && img.src !== (img_src_value = "/projects/" + /*project*/ ctx[12].id + ".jpg")) {
    				attr_dev(img, "src", img_src_value);
    			}

    			if (!current || dirty & /*filteredProjects*/ 2 && img_alt_value !== (img_alt_value = /*project*/ ctx[12].id)) {
    				attr_dev(img, "alt", img_alt_value);
    			}

    			if ((!current || dirty & /*filteredProjects*/ 2) && t3_value !== (t3_value = /*project*/ ctx[12].title + "")) set_data_dev(t3, t3_value);

    			if (dirty & /*filteredProjects*/ 2) {
    				each_value_2 = /*project*/ ctx[12].tags;
    				validate_each_argument(each_value_2);
    				let i;

    				for (i = 0; i < each_value_2.length; i += 1) {
    					const child_ctx = get_each_context_2(ctx, each_value_2, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block_2(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(p1, null);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value_2.length;
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block);

    			add_render_callback(() => {
    				if (!div5_transition) div5_transition = create_bidirectional_transition(div5, scale, {}, true);
    				div5_transition.run(1);
    			});

    			current = true;
    		},
    		o: function outro(local) {
    			if (!div5_transition) div5_transition = create_bidirectional_transition(div5, scale, {}, false);
    			div5_transition.run(0);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div5);
    			if (if_block) if_block.d();
    			destroy_each(each_blocks, detaching);
    			if (detaching && div5_transition) div5_transition.end();
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block_1.name,
    		type: "each",
    		source: "(123:2) {#each filteredProjects as project, i}",
    		ctx
    	});

    	return block;
    }

    // (212:16) {#each singleProject.tags as tag, i}
    function create_each_block(ctx) {
    	let span;
    	let img;
    	let img_src_value;
    	let t;

    	const block = {
    		c: function create() {
    			span = element("span");
    			img = element("img");
    			t = text("\r\n                   ");
    			if (img.src !== (img_src_value = "/icons/" + /*tag*/ ctx[9] + ".png")) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "alt", "");
    			attr_dev(img, "class", "image");
    			attr_dev(img, "width", "30px");
    			add_location(img, file$4, 213, 20, 5512);
    			attr_dev(span, "class", "badge badge-pill badge-default");
    			add_location(span, file$4, 212, 18, 5445);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, span, anchor);
    			append_dev(span, img);
    			insert_dev(target, t, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*singleProject*/ 1 && img.src !== (img_src_value = "/icons/" + /*tag*/ ctx[9] + ".png")) {
    				attr_dev(img, "src", img_src_value);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(span);
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block.name,
    		type: "each",
    		source: "(212:16) {#each singleProject.tags as tag, i}",
    		ctx
    	});

    	return block;
    }

    // (226:14) {#if singleProject.live != ''}
    function create_if_block_1$1(ctx) {
    	let a;
    	let i;
    	let t;
    	let a_href_value;

    	const block = {
    		c: function create() {
    			a = element("a");
    			i = element("i");
    			t = text("\r\n                  Live Demo");
    			attr_dev(i, "class", "fas fa-eye");
    			add_location(i, file$4, 230, 18, 6112);
    			attr_dev(a, "class", "btn btn-primary text-white");
    			attr_dev(a, "href", a_href_value = /*singleProject*/ ctx[0].live);
    			attr_dev(a, "target", "_blank");
    			add_location(a, file$4, 226, 16, 5955);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, a, anchor);
    			append_dev(a, i);
    			append_dev(a, t);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*singleProject*/ 1 && a_href_value !== (a_href_value = /*singleProject*/ ctx[0].live)) {
    				attr_dev(a, "href", a_href_value);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(a);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1$1.name,
    		type: "if",
    		source: "(226:14) {#if singleProject.live != ''}",
    		ctx
    	});

    	return block;
    }

    // (236:14) {#if singleProject.source != ''}
    function create_if_block$1(ctx) {
    	let a;
    	let i;
    	let t;
    	let a_href_value;

    	const block = {
    		c: function create() {
    			a = element("a");
    			i = element("i");
    			t = text("\r\n                  Source Code");
    			attr_dev(i, "class", "fab fa-github");
    			add_location(i, file$4, 240, 18, 6432);
    			attr_dev(a, "class", "btn btn-info text-white");
    			attr_dev(a, "href", a_href_value = /*singleProject*/ ctx[0].source);
    			attr_dev(a, "target", "_blank");
    			add_location(a, file$4, 236, 16, 6276);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, a, anchor);
    			append_dev(a, i);
    			append_dev(a, t);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*singleProject*/ 1 && a_href_value !== (a_href_value = /*singleProject*/ ctx[0].source)) {
    				attr_dev(a, "href", a_href_value);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(a);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$1.name,
    		type: "if",
    		source: "(236:14) {#if singleProject.source != ''}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$4(ctx) {
    	let div2;
    	let h20;
    	let t1;
    	let div0;
    	let button0;
    	let t3;
    	let button1;
    	let t5;
    	let button2;
    	let t7;
    	let button3;
    	let t9;
    	let br;
    	let t10;
    	let div1;
    	let a;
    	let i0;
    	let t11;
    	let t12;
    	let div3;
    	let t13;
    	let div13;
    	let div12;
    	let div11;
    	let button4;
    	let span;
    	let i1;
    	let t14;
    	let div10;
    	let div9;
    	let div8;
    	let div7;
    	let h21;
    	let t15_value = /*singleProject*/ ctx[0].title + "";
    	let t15;
    	let t16;
    	let div6;
    	let div4;
    	let t17;
    	let div5;
    	let t18;
    	let img;
    	let img_src_value;
    	let t19;
    	let h6;
    	let t21;
    	let h5;
    	let t22;
    	let p0;
    	let t23;
    	let p1;
    	let t24_value = /*singleProject*/ ctx[0].desc + "";
    	let t24;
    	let t25;
    	let t26;
    	let current;
    	let dispose;
    	let each_value_1 = /*filteredProjects*/ ctx[1];
    	validate_each_argument(each_value_1);
    	let each_blocks_1 = [];

    	for (let i = 0; i < each_value_1.length; i += 1) {
    		each_blocks_1[i] = create_each_block_1(get_each_context_1(ctx, each_value_1, i));
    	}

    	const out = i => transition_out(each_blocks_1[i], 1, 1, () => {
    		each_blocks_1[i] = null;
    	});

    	let each_value = /*singleProject*/ ctx[0].tags;
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    	}

    	let if_block0 = /*singleProject*/ ctx[0].live != "" && create_if_block_1$1(ctx);
    	let if_block1 = /*singleProject*/ ctx[0].source != "" && create_if_block$1(ctx);

    	const block = {
    		c: function create() {
    			div2 = element("div");
    			h20 = element("h2");
    			h20.textContent = "Projects";
    			t1 = space();
    			div0 = element("div");
    			button0 = element("button");
    			button0.textContent = "All";
    			t3 = space();
    			button1 = element("button");
    			button1.textContent = "Web";
    			t5 = space();
    			button2 = element("button");
    			button2.textContent = "Mobile";
    			t7 = space();
    			button3 = element("button");
    			button3.textContent = "Other";
    			t9 = space();
    			br = element("br");
    			t10 = space();
    			div1 = element("div");
    			a = element("a");
    			i0 = element("i");
    			t11 = text("\r\n      Get Resume");
    			t12 = space();
    			div3 = element("div");

    			for (let i = 0; i < each_blocks_1.length; i += 1) {
    				each_blocks_1[i].c();
    			}

    			t13 = space();
    			div13 = element("div");
    			div12 = element("div");
    			div11 = element("div");
    			button4 = element("button");
    			span = element("span");
    			i1 = element("i");
    			t14 = space();
    			div10 = element("div");
    			div9 = element("div");
    			div8 = element("div");
    			div7 = element("div");
    			h21 = element("h2");
    			t15 = text(t15_value);
    			t16 = space();
    			div6 = element("div");
    			div4 = element("div");
    			t17 = space();
    			div5 = element("div");
    			t18 = space();
    			img = element("img");
    			t19 = space();
    			h6 = element("h6");
    			h6.textContent = "Technologies used:";
    			t21 = space();
    			h5 = element("h5");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t22 = space();
    			p0 = element("p");
    			t23 = space();
    			p1 = element("p");
    			t24 = text(t24_value);
    			t25 = space();
    			if (if_block0) if_block0.c();
    			t26 = space();
    			if (if_block1) if_block1.c();
    			add_location(h20, file$4, 67, 2, 1219);
    			attr_dev(button0, "type", "button");
    			attr_dev(button0, "class", "btn btn-lg btn-info");
    			toggle_class(button0, "active", /*current*/ ctx[2] === 0);
    			add_location(button0, file$4, 69, 4, 1311);
    			attr_dev(button1, "type", "button");
    			attr_dev(button1, "class", "btn btn-lg btn-info");
    			toggle_class(button1, "active", /*current*/ ctx[2] === 1);
    			add_location(button1, file$4, 79, 4, 1527);
    			attr_dev(button2, "type", "button");
    			attr_dev(button2, "class", "btn btn-lg btn-info");
    			toggle_class(button2, "active", /*current*/ ctx[2] === 2);
    			add_location(button2, file$4, 89, 4, 1743);
    			attr_dev(button3, "type", "button");
    			attr_dev(button3, "class", "btn btn-lg btn-info");
    			toggle_class(button3, "active", /*current*/ ctx[2] === 3);
    			add_location(button3, file$4, 99, 4, 1965);
    			attr_dev(div0, "class", "btn-group");
    			attr_dev(div0, "role", "group");
    			attr_dev(div0, "aria-label", "Filter projects");
    			add_location(div0, file$4, 68, 2, 1240);
    			add_location(br, file$4, 110, 2, 2193);
    			attr_dev(i0, "class", "fas fa-download");
    			add_location(i0, file$4, 116, 6, 2468);
    			attr_dev(a, "href", "https://docs.google.com/document/d/1Axfpm_HCpW5CkPHxwwBUZcnAoZtRbl9q8l2D-YiSqcE/edit?usp=sharing");
    			attr_dev(a, "target", "_blank");
    			attr_dev(a, "class", "btn btn-sm btn-outline-primary");
    			add_location(a, file$4, 112, 4, 2277);
    			attr_dev(div1, "class", "btn-group resume");
    			attr_dev(div1, "role", "group");
    			attr_dev(div1, "aria-label", "Third group");
    			add_location(div1, file$4, 111, 2, 2203);
    			attr_dev(div2, "class", "project-filter svelte-po4bhc");
    			add_location(div2, file$4, 66, 0, 1187);
    			attr_dev(div3, "class", "row projects svelte-po4bhc");
    			add_location(div3, file$4, 121, 0, 2545);
    			attr_dev(i1, "class", "fas fa-times fa-2x");
    			add_location(i1, file$4, 186, 10, 4412);
    			attr_dev(span, "aria-hidden", "true");
    			add_location(span, file$4, 185, 8, 4375);
    			attr_dev(button4, "type", "button");
    			attr_dev(button4, "class", "close");
    			attr_dev(button4, "data-dismiss", "modal");
    			attr_dev(button4, "aria-label", "Close");
    			add_location(button4, file$4, 180, 6, 4253);
    			attr_dev(h21, "class", "portfolio-modal-title text-secondary text-uppercase mb-0");
    			add_location(h21, file$4, 194, 14, 4707);
    			attr_dev(div4, "class", "divider-custom-line");
    			add_location(div4, file$4, 200, 16, 4952);
    			attr_dev(div5, "class", "divider-custom-line");
    			add_location(div5, file$4, 201, 16, 5005);
    			attr_dev(div6, "class", "divider-custom");
    			add_location(div6, file$4, 199, 14, 4906);
    			attr_dev(img, "class", "img-fluid rounded mb-5 modal-img svelte-po4bhc");
    			if (img.src !== (img_src_value = "/projects/" + /*singleProject*/ ctx[0].id + ".jpg")) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "alt", "");
    			add_location(img, file$4, 204, 14, 5126);
    			add_location(h6, file$4, 209, 14, 5324);
    			add_location(h5, file$4, 210, 14, 5367);
    			add_location(p0, file$4, 222, 14, 5783);
    			attr_dev(p1, "class", "mb-5");
    			add_location(p1, file$4, 224, 14, 5851);
    			attr_dev(div7, "class", "col-lg-8");
    			add_location(div7, file$4, 192, 12, 4621);
    			attr_dev(div8, "class", "row justify-content-center");
    			add_location(div8, file$4, 191, 10, 4567);
    			attr_dev(div9, "class", "container");
    			add_location(div9, file$4, 190, 8, 4532);
    			attr_dev(div10, "class", "modal-body text-center");
    			add_location(div10, file$4, 189, 6, 4486);
    			attr_dev(div11, "class", "modal-content");
    			add_location(div11, file$4, 179, 4, 4218);
    			attr_dev(div12, "class", "modal-dialog modal-xl");
    			attr_dev(div12, "role", "document");
    			add_location(div12, file$4, 178, 2, 4161);
    			attr_dev(div13, "class", "modal fade");
    			attr_dev(div13, "id", "singleProjectModal");
    			attr_dev(div13, "tabindex", "-1");
    			attr_dev(div13, "role", "dialog");
    			attr_dev(div13, "aria-labelledby", "singleProjectModalLabel");
    			attr_dev(div13, "aria-hidden", "true");
    			add_location(div13, file$4, 171, 0, 4002);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor, remount) {
    			insert_dev(target, div2, anchor);
    			append_dev(div2, h20);
    			append_dev(div2, t1);
    			append_dev(div2, div0);
    			append_dev(div0, button0);
    			append_dev(div0, t3);
    			append_dev(div0, button1);
    			append_dev(div0, t5);
    			append_dev(div0, button2);
    			append_dev(div0, t7);
    			append_dev(div0, button3);
    			append_dev(div2, t9);
    			append_dev(div2, br);
    			append_dev(div2, t10);
    			append_dev(div2, div1);
    			append_dev(div1, a);
    			append_dev(a, i0);
    			append_dev(a, t11);
    			insert_dev(target, t12, anchor);
    			insert_dev(target, div3, anchor);

    			for (let i = 0; i < each_blocks_1.length; i += 1) {
    				each_blocks_1[i].m(div3, null);
    			}

    			insert_dev(target, t13, anchor);
    			insert_dev(target, div13, anchor);
    			append_dev(div13, div12);
    			append_dev(div12, div11);
    			append_dev(div11, button4);
    			append_dev(button4, span);
    			append_dev(span, i1);
    			append_dev(div11, t14);
    			append_dev(div11, div10);
    			append_dev(div10, div9);
    			append_dev(div9, div8);
    			append_dev(div8, div7);
    			append_dev(div7, h21);
    			append_dev(h21, t15);
    			append_dev(div7, t16);
    			append_dev(div7, div6);
    			append_dev(div6, div4);
    			append_dev(div6, t17);
    			append_dev(div6, div5);
    			append_dev(div7, t18);
    			append_dev(div7, img);
    			append_dev(div7, t19);
    			append_dev(div7, h6);
    			append_dev(div7, t21);
    			append_dev(div7, h5);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(h5, null);
    			}

    			append_dev(div7, t22);
    			append_dev(div7, p0);
    			append_dev(div7, t23);
    			append_dev(div7, p1);
    			append_dev(p1, t24);
    			append_dev(div7, t25);
    			if (if_block0) if_block0.m(div7, null);
    			append_dev(div7, t26);
    			if (if_block1) if_block1.m(div7, null);
    			current = true;
    			if (remount) run_all(dispose);

    			dispose = [
    				listen_dev(button0, "click", /*click_handler*/ ctx[4], false, false, false),
    				listen_dev(button1, "click", /*click_handler_1*/ ctx[5], false, false, false),
    				listen_dev(button2, "click", /*click_handler_2*/ ctx[6], false, false, false),
    				listen_dev(button3, "click", /*click_handler_3*/ ctx[7], false, false, false)
    			];
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*current*/ 4) {
    				toggle_class(button0, "active", /*current*/ ctx[2] === 0);
    			}

    			if (dirty & /*current*/ 4) {
    				toggle_class(button1, "active", /*current*/ ctx[2] === 1);
    			}

    			if (dirty & /*current*/ 4) {
    				toggle_class(button2, "active", /*current*/ ctx[2] === 2);
    			}

    			if (dirty & /*current*/ 4) {
    				toggle_class(button3, "active", /*current*/ ctx[2] === 3);
    			}

    			if (dirty & /*singleProject, filteredProjects*/ 3) {
    				each_value_1 = /*filteredProjects*/ ctx[1];
    				validate_each_argument(each_value_1);
    				let i;

    				for (i = 0; i < each_value_1.length; i += 1) {
    					const child_ctx = get_each_context_1(ctx, each_value_1, i);

    					if (each_blocks_1[i]) {
    						each_blocks_1[i].p(child_ctx, dirty);
    						transition_in(each_blocks_1[i], 1);
    					} else {
    						each_blocks_1[i] = create_each_block_1(child_ctx);
    						each_blocks_1[i].c();
    						transition_in(each_blocks_1[i], 1);
    						each_blocks_1[i].m(div3, null);
    					}
    				}

    				group_outros();

    				for (i = each_value_1.length; i < each_blocks_1.length; i += 1) {
    					out(i);
    				}

    				check_outros();
    			}

    			if ((!current || dirty & /*singleProject*/ 1) && t15_value !== (t15_value = /*singleProject*/ ctx[0].title + "")) set_data_dev(t15, t15_value);

    			if (!current || dirty & /*singleProject*/ 1 && img.src !== (img_src_value = "/projects/" + /*singleProject*/ ctx[0].id + ".jpg")) {
    				attr_dev(img, "src", img_src_value);
    			}

    			if (dirty & /*singleProject*/ 1) {
    				each_value = /*singleProject*/ ctx[0].tags;
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(h5, null);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}

    			if ((!current || dirty & /*singleProject*/ 1) && t24_value !== (t24_value = /*singleProject*/ ctx[0].desc + "")) set_data_dev(t24, t24_value);

    			if (/*singleProject*/ ctx[0].live != "") {
    				if (if_block0) {
    					if_block0.p(ctx, dirty);
    				} else {
    					if_block0 = create_if_block_1$1(ctx);
    					if_block0.c();
    					if_block0.m(div7, t26);
    				}
    			} else if (if_block0) {
    				if_block0.d(1);
    				if_block0 = null;
    			}

    			if (/*singleProject*/ ctx[0].source != "") {
    				if (if_block1) {
    					if_block1.p(ctx, dirty);
    				} else {
    					if_block1 = create_if_block$1(ctx);
    					if_block1.c();
    					if_block1.m(div7, null);
    				}
    			} else if (if_block1) {
    				if_block1.d(1);
    				if_block1 = null;
    			}
    		},
    		i: function intro(local) {
    			if (current) return;

    			for (let i = 0; i < each_value_1.length; i += 1) {
    				transition_in(each_blocks_1[i]);
    			}

    			current = true;
    		},
    		o: function outro(local) {
    			each_blocks_1 = each_blocks_1.filter(Boolean);

    			for (let i = 0; i < each_blocks_1.length; i += 1) {
    				transition_out(each_blocks_1[i]);
    			}

    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div2);
    			if (detaching) detach_dev(t12);
    			if (detaching) detach_dev(div3);
    			destroy_each(each_blocks_1, detaching);
    			if (detaching) detach_dev(t13);
    			if (detaching) detach_dev(div13);
    			destroy_each(each_blocks, detaching);
    			if (if_block0) if_block0.d();
    			if (if_block1) if_block1.d();
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$4.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$4($$self, $$props, $$invalidate) {
    	console.log("hey");
    	let singleProject = projects[0];
    	let filteredProjects = projects;
    	let current = 0;

    	function setFilter(cat) {
    		cat == "all"
    		? $$invalidate(1, filteredProjects = projects)
    		: $$invalidate(1, filteredProjects = projects.filter(p => p.category == cat));

    		filteredProjects.sort(function (a, b) {
    			return a - b;
    		});
    	}

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console_1.warn(`<Projects> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("Projects", $$slots, []);

    	const click_handler = () => {
    		setFilter("all");
    		$$invalidate(2, current = 0);
    	};

    	const click_handler_1 = () => {
    		setFilter("web");
    		$$invalidate(2, current = 1);
    	};

    	const click_handler_2 = () => {
    		setFilter("mobile");
    		$$invalidate(2, current = 2);
    	};

    	const click_handler_3 = () => {
    		setFilter("other");
    		$$invalidate(2, current = 3);
    	};

    	const click_handler_4 = project => {
    		$$invalidate(0, singleProject = project);
    	};

    	$$self.$capture_state = () => ({
    		scale,
    		slide,
    		projects,
    		singleProject,
    		filteredProjects,
    		current,
    		setFilter
    	});

    	$$self.$inject_state = $$props => {
    		if ("singleProject" in $$props) $$invalidate(0, singleProject = $$props.singleProject);
    		if ("filteredProjects" in $$props) $$invalidate(1, filteredProjects = $$props.filteredProjects);
    		if ("current" in $$props) $$invalidate(2, current = $$props.current);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		singleProject,
    		filteredProjects,
    		current,
    		setFilter,
    		click_handler,
    		click_handler_1,
    		click_handler_2,
    		click_handler_3,
    		click_handler_4
    	];
    }

    class Projects extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$4, create_fragment$4, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Projects",
    			options,
    			id: create_fragment$4.name
    		});
    	}
    }

    /* src\components\Contact.svelte generated by Svelte v3.21.0 */

    const file$5 = "src\\components\\Contact.svelte";

    function create_fragment$5(ctx) {
    	let div1;
    	let br;
    	let t0;
    	let h1;
    	let t2;
    	let div0;
    	let iframe;
    	let iframe_src_value;

    	const block = {
    		c: function create() {
    			div1 = element("div");
    			br = element("br");
    			t0 = space();
    			h1 = element("h1");
    			h1.textContent = "Let's Keep in touch";
    			t2 = space();
    			div0 = element("div");
    			iframe = element("iframe");
    			iframe.textContent = "Loading…";
    			add_location(br, file$5, 1, 2, 39);
    			add_location(h1, file$5, 2, 2, 49);
    			attr_dev(iframe, "title", "contact");
    			attr_dev(iframe, "class", "embed-responsive-item");
    			if (iframe.src !== (iframe_src_value = "https://docs.google.com/forms/d/e/1FAIpQLSfZPllgswXjPgZY_Rzm3hZPxIKYcOv_N8_n2FlC9bzGU2PrEA/viewform?embedded=true")) attr_dev(iframe, "src", iframe_src_value);
    			attr_dev(iframe, "frameborder", "0");
    			add_location(iframe, file$5, 4, 4, 139);
    			attr_dev(div0, "class", "embed-responsive embed-responsive-4by3");
    			add_location(div0, file$5, 3, 2, 81);
    			attr_dev(div1, "class", "container text-center");
    			add_location(div1, file$5, 0, 0, 0);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div1, anchor);
    			append_dev(div1, br);
    			append_dev(div1, t0);
    			append_dev(div1, h1);
    			append_dev(div1, t2);
    			append_dev(div1, div0);
    			append_dev(div0, iframe);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div1);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$5.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$5($$self, $$props) {
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Contact> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("Contact", $$slots, []);
    	return [];
    }

    class Contact extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$5, create_fragment$5, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Contact",
    			options,
    			id: create_fragment$5.name
    		});
    	}
    }

    /* src\App.svelte generated by Svelte v3.21.0 */
    const file$6 = "src\\App.svelte";

    // (25:0) {:else}
    function create_else_block(ctx) {
    	let style;

    	const block = {
    		c: function create() {
    			style = element("style");
    			style.textContent = "body {\r\n      background: black;\r\n    }";
    			add_location(style, file$6, 25, 2, 613);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, style, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(style);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block.name,
    		type: "else",
    		source: "(25:0) {:else}",
    		ctx
    	});

    	return block;
    }

    // (13:0) {#if !dark}
    function create_if_block$2(ctx) {
    	let style;

    	const block = {
    		c: function create() {
    			style = element("style");
    			style.textContent = ":global(body) {\r\n      font-family: \"Poppins\", sans-serif;\r\n      /* background: #f8f9fc; */\r\n      background: #f8f9fc;\r\n    }\r\n\r\n    .main {\r\n      background: white;\r\n    }";
    			add_location(style, file$6, 13, 2, 400);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, style, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(style);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$2.name,
    		type: "if",
    		source: "(13:0) {#if !dark}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$6(ctx) {
    	let t0;
    	let header;
    	let t1;
    	let div;
    	let t2;
    	let t3;
    	let t4;
    	let footer1;
    	let current;

    	function select_block_type(ctx, dirty) {
    		if (!/*dark*/ ctx[0]) return create_if_block$2;
    		return create_else_block;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block = current_block_type(ctx);
    	const navbar = new Navbar({ $$inline: true });
    	const hero = new Hero({ $$inline: true });
    	const projects = new Projects({ $$inline: true });
    	const contact = new Contact({ $$inline: true });
    	const footer0 = new Footer({ $$inline: true });

    	const block = {
    		c: function create() {
    			if_block.c();
    			t0 = space();
    			header = element("header");
    			create_component(navbar.$$.fragment);
    			t1 = space();
    			div = element("div");
    			create_component(hero.$$.fragment);
    			t2 = space();
    			create_component(projects.$$.fragment);
    			t3 = space();
    			create_component(contact.$$.fragment);
    			t4 = space();
    			footer1 = element("footer");
    			create_component(footer0.$$.fragment);
    			add_location(header, file$6, 32, 0, 688);
    			attr_dev(div, "class", "container-fluid main");
    			add_location(div, file$6, 35, 0, 723);
    			add_location(footer1, file$6, 42, 0, 834);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			if_block.m(target, anchor);
    			insert_dev(target, t0, anchor);
    			insert_dev(target, header, anchor);
    			mount_component(navbar, header, null);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, div, anchor);
    			mount_component(hero, div, null);
    			append_dev(div, t2);
    			mount_component(projects, div, null);
    			append_dev(div, t3);
    			mount_component(contact, div, null);
    			insert_dev(target, t4, anchor);
    			insert_dev(target, footer1, anchor);
    			mount_component(footer0, footer1, null);
    			current = true;
    		},
    		p: noop,
    		i: function intro(local) {
    			if (current) return;
    			transition_in(navbar.$$.fragment, local);
    			transition_in(hero.$$.fragment, local);
    			transition_in(projects.$$.fragment, local);
    			transition_in(contact.$$.fragment, local);
    			transition_in(footer0.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(navbar.$$.fragment, local);
    			transition_out(hero.$$.fragment, local);
    			transition_out(projects.$$.fragment, local);
    			transition_out(contact.$$.fragment, local);
    			transition_out(footer0.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if_block.d(detaching);
    			if (detaching) detach_dev(t0);
    			if (detaching) detach_dev(header);
    			destroy_component(navbar);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(div);
    			destroy_component(hero);
    			destroy_component(projects);
    			destroy_component(contact);
    			if (detaching) detach_dev(t4);
    			if (detaching) detach_dev(footer1);
    			destroy_component(footer0);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$6.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$6($$self, $$props, $$invalidate) {
    	let projectsSize = [0];
    	let dark = false;
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("App", $$slots, []);

    	$$self.$capture_state = () => ({
    		Navbar,
    		Hero,
    		Footer,
    		Intro,
    		Projects,
    		Contact,
    		projectsSize,
    		dark
    	});

    	$$self.$inject_state = $$props => {
    		if ("projectsSize" in $$props) projectsSize = $$props.projectsSize;
    		if ("dark" in $$props) $$invalidate(0, dark = $$props.dark);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [dark];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$6, create_fragment$6, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment$6.name
    		});
    	}
    }

    const app = new App({
    	target: document.body,
    });

    return app;

}());
//# sourceMappingURL=bundle.js.map
