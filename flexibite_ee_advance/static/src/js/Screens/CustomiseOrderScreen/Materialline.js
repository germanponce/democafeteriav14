odoo.define('flexibite_ee_advance.Materialline', function(require) {
    'use strict';

    const PosComponent = require('point_of_sale.PosComponent');
    const Registries = require('point_of_sale.Registries');

    class Materialline extends PosComponent {
        selectLine() {
            this.trigger('select-line', { materialline: this.props.line });
        }
        replaceButtonClicked() {
            this.trigger('click-replace-product', { materialline: this.props.line });
        }
        closeButtonClicked(){
            this.trigger('click-close-replacewidget');
        }
        resetButtonClicked() {
            this.trigger('click-reset-product', { materialline: this.props.line });
        }
        get addedClasses() {
            return {
                selected: this.props.line.selected,
            };
        }
        get showMax() {
            const max = true ? this.props.line.max > this.props.line.quantity : false;
            return max;
        }
    }
    Materialline.template = 'Materialline';

    Registries.Component.add(Materialline);

    return Materialline;
});
