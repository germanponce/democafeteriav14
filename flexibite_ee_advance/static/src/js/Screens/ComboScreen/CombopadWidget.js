odoo.define('flexibite_ee_advance.CombopadWidget', function(require) {
    'use strict';

    const PosComponent = require('point_of_sale.PosComponent');
    const Registries = require('point_of_sale.Registries');


    class CombopadWidget extends PosComponent {
        get currentOrder() {
            return this.env.pos.get_order();
        }
        get line(){
            return this.currentOrder.get_selected_comboline();
        }
        get enable(){
            if(this.line != undefined){
                return this.line.require;
            }
        }
    }
    CombopadWidget.template = 'CombopadWidget';

    Registries.Component.add(CombopadWidget);

    return CombopadWidget;
});
