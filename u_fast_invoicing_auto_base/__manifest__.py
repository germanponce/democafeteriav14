# -*- coding: utf-8 -*-
{
    'name': "Unoobi | u_fast_invoicing_auto_mass",
    'summary': "Auto invoice massive tickets",
    'description': """
        Auto invoice massive tickets.
    """,
    'author': "Unoobi",
    'category': 'Tools',
    'version': '0.1',
    'depends': [
        'u_fast_invoicing_sale_order'
    ],
    'data': [
        # Data
        'data/cron_data.xml',
        # Views
        'views/inherit_res_config_settings_view.xml',
    ],
    'qweb': [],
}
