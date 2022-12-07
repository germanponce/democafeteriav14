odoo.define('point_of_sale.MergeCombolinePopup', function(require) {
    'use strict';

    const { useState } = owl;
    const AbstractAwaitablePopup = require('point_of_sale.AbstractAwaitablePopup');
    const PosComponent = require('point_of_sale.PosComponent');
    const NumberBuffer = require('point_of_sale.NumberBuffer');
    const { useListener } = require('web.custom_hooks');
    const Registries = require('point_of_sale.Registries');


    class MergeCombolinePopup extends AbstractAwaitablePopup {
        constructor() {
            super(...arguments);
            useListener('click-head', this._clickHead);
            this.state = useState({
                selected_lines: {},
            });

        }
        mounted() {
            for(var i=0; i< this.props.list.length; i++){
                this.state.selected_lines[this.props.list[i].cid] = false;
            }
        }
        _clickHead(event){
            this.state.selected_lines[event.detail.id] = this.state.selected_lines[event.detail.id] == true ? false : true;
        }
        getPayload() {
            return this.state.selected_lines;
        }
    }
    MergeCombolinePopup.template = 'MergeCombolinePopup';

    Registries.Component.add(MergeCombolinePopup);

    class LineMergeView extends PosComponent {}
    LineMergeView.template = 'LineMergeView';
    Registries.Component.add(LineMergeView);

    return {
        MergeCombolinePopup,
        LineMergeView,
    };

});
