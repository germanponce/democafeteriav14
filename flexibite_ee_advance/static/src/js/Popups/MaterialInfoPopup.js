odoo.define('flexibite_ee_advance.MaterialInfoPopup', function (require) {
    'use strict';

    const { useState, useExternalListener } = owl.hooks;
    const AbstractAwaitablePopup = require('point_of_sale.AbstractAwaitablePopup');
    const Registries = require('point_of_sale.Registries');

    class MaterialInfoPopup extends AbstractAwaitablePopup {
        constructor() {
            super(...arguments);
        }
        _cancelAtClick(event){
            this.cancel();
        }
    }
    MaterialInfoPopup.template = 'MaterialInfoPopup';


    Registries.Component.add(MaterialInfoPopup);

    return MaterialInfoPopup;
});
