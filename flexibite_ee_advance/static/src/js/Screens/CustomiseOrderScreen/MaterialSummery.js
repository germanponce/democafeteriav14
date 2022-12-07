odoo.define('flexibite_ee_advance.MaterialSummary', function(require) {
    'use strict';

    const PosComponent = require('point_of_sale.PosComponent');
    const Registries = require('point_of_sale.Registries');

    class MaterialSummary extends PosComponent {}
    MaterialSummary.template = 'MaterialSummary';

    Registries.Component.add(MaterialSummary);

    return MaterialSummary;
});
