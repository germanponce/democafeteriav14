odoo.define('point_of_sale.SplitCombolinePopup', function(require) {
    'use strict';

    const { useState } = owl;
    const AbstractAwaitablePopup = require('point_of_sale.AbstractAwaitablePopup');
    const NumberBuffer = require('point_of_sale.NumberBuffer');
    const { useListener } = require('web.custom_hooks');
    const Registries = require('point_of_sale.Registries');


    class SplitCombolinePopup extends AbstractAwaitablePopup {
        constructor() {
            super(...arguments);
            useListener('accept-input', this.confirm);
            useListener('close-this-popup', this.cancel);
            let startingBuffer = '';
            if (typeof this.props.startingValue === 'number' && this.props.startingValue > 0) {
                startingBuffer = this.props.startingValue.toString();
            }
            this.state = useState({ buffer: startingBuffer });
            NumberBuffer.use({
                nonKeyboardInputEvent: 'numpad-click-input',
                triggerAtEnter: 'accept-input',
                triggerAtEscape: 'close-this-popup',
                state: this.state,
            });
        }
        get inputBuffer() {
            if (this.state.buffer === null) {
                return '';
            }
            return this.state.buffer;
        }
        async defaultCopy() {
            this.props.resolve({ confirmed: false, defaultCopy: true, payload: await this.getPayload() });
            this.trigger('close-popup');
        }
        sendInput(key) {
            this.trigger('numpad-click-input', { key });
        }
        getPayload() {
            return NumberBuffer.get();
        }
    }
    SplitCombolinePopup.template = 'SplitCombolinePopup';

    Registries.Component.add(SplitCombolinePopup);

    return SplitCombolinePopup;
});
