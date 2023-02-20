project('gnome-typescript-template',
          version: '0.1.0',
    meson_version: '>= 0.62.0',
  default_options: [ 'warning_level=2', 'werror=false', ],
)

i18n = import('i18n')
gnome = import('gnome')

gjs_dep = dependency('gjs-1.0', version: '>= 1.54.0')
gjs_console = gjs_dep.get_variable(pkgconfig: 'gjs_console')

pm_name = get_option('package-manager')

package_manager = find_program(pm_name, required: true)

package_manager_args = []

offline_mirror = get_option('offline-mirror')
if pm_name == 'yarn' and offline_mirror != ''
  run_command(
    package_manager,
    'config',
    '--offline',
    'set',
    'yarn-offline-mirror',
    offline_mirror,
    env: { 'HOME': meson.project_build_root() },
    check: true
  )

  package_manager_args += [
    '--offline',
    '--use-yarnrc', meson.project_build_root() / '.yarnrc'
  ]
endif

package_manager_deps = custom_target(
  'node-package-manager-deps',
  command: [ package_manager, 'install', package_manager_args ],
  output: ['node-package-manager-out']
)

subdir('data')
subdir('src')
subdir('po')

gnome.post_install(
     glib_compile_schemas: true,
    gtk_update_icon_cache: true,
  update_desktop_database: true,
)
