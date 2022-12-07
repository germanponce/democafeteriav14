odoo.define('flexibite_ee_advance.ComboInfoPopup', function (require) {
    'use strict';

    const { useState, useExternalListener } = owl.hooks;
    const AbstractAwaitablePopup = require('point_of_sale.AbstractAwaitablePopup');
    const Registries = require('point_of_sale.Registries');
    const { useListener } = require('web.custom_hooks');


    class ComboInfoPopup extends AbstractAwaitablePopup {
        constructor() {
            super(...arguments);
            useListener('click-material-info', this._clickMaterialInfo);
        }
        async _clickMaterialInfo(event){
            const { confirmed } = await this.showPopup(
                'MaterialInfoPopup',
                {
                    title: event.detail.name,
                    list: event.detail.materiallines,
                }
            );
        }
    }
    ComboInfoPopup.template = 'ComboInfoPopup';

    Registries.Component.add(ComboInfoPopup);

    return ComboInfoPopup;
});
