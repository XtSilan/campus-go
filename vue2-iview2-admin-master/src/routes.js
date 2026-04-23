import Login from './pages/Login.vue'
import NotFound from './pages/404.vue'
import Home from './pages/Home.vue'
import Main from './pages/Main.vue'
import Table from './pages/nav1/Table.vue'
import Form from './pages/nav1/Form.vue'
import user from './pages/nav1/user.vue'
import StorageSettings from './pages/nav2/StorageSettings.vue'
import MediaLibrary from './pages/nav2/MediaLibrary.vue'

let routes = [{
        path: '/login',
        component: Login,
        name: '',
        hidden: true
    },
    {
        path: '/404',
        component: NotFound,
        name: '',
        hidden: true
    },
    //{ path: '/main', component: Main },
    {
        path: '/',
        component: Home,
        name: '运营台',
        iconCls: 'ios-speedometer',
        children: [
            { path: '/main', component: Main, name: '数据总览' },
        ]
    },
    {
        path: '/',
        component: Home,
        name: '商品中心',
        iconCls: 'ios-basket',
        children: [
            { path: '/table', component: Table, name: '商品管理' },
            { path: '/form', component: Form, name: '通知管理' }
        ]
    },
    {
        path: '/',
        component: Home,
        name: '用户中心',
        iconCls: 'ios-people',
        children: [
            { path: '/user', component: user, name: '用户管理' }
        ]
    },
    {
        path: '/',
        component: Home,
        name: '系统设置',
        iconCls: 'ios-cog',
        children: [
            { path: '/storage', component: StorageSettings, name: '存储设置' },
            { path: '/media-library', component: MediaLibrary, name: '媒体库' }
        ]
    },
    {
        path: '*',
        hidden: true,
        redirect: { path: '/404' }
    }
];

export default routes;
