project('sticky-notes',
          version: '0.2.1',
    meson_version: '>= 0.62.0',
  default_options: [ 'warning_level=2', 'werror=false', ],
)

application_id = 'com.vixalien.sticky'
GETTEXT_PACKAGE = application_id

i18n = import('i18n')
gnome = import('gnome')

gjs_dep = dependency('gjs-1.0', version: '>= 1.54.0')
gjs_console = gjs_dep.get_variable(pkgconfig: 'gjs_console')
yarn = find_program('yarn', required: true)

yarn_args = ['--cwd', meson.project_source_root()]

yarn_deps = custom_target(
  'yarn-deps',
  command: [ yarn, yarn_args, 'install' ],
  output: ['node_modules']
)

subdir('data')
subdir('src')
subdir('po')

gnome.post_install(
     glib_compile_schemas: true,
    gtk_update_icon_cache: true,
  update_desktop_database: true,
)
