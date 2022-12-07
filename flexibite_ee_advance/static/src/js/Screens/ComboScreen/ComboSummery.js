odoo.define('flexibite_ee_advance.ComboSummary', function(require) {
    'use strict';

    const PosComponent = require('point_of_sale.PosComponent');
    const Registries = require('point_of_sale.Registries');

    class ComboSummary extends PosComponent {}
    ComboSummary.template = 'ComboSummary';

    Registries.Component.add(ComboSummary);

    return ComboSummary;
});
