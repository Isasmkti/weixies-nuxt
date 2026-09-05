import Swal from 'sweetalert2'
import 'sweetalert2/dist/sweetalert2.min.css'

const themedOptions = () => ({
  background: 'rgb(var(--color-surface))',
  color: 'rgb(var(--color-text))',
  confirmButtonColor: 'rgb(var(--color-primary))',
  cancelButtonColor: 'rgb(var(--color-text-muted))',
  reverseButtons: true,
  customClass: {
    popup: 'weixies-swal-popup',
    confirmButton: 'weixies-swal-button',
    cancelButton: 'weixies-swal-button',
    input: 'weixies-swal-input',
  },
})

const mergeOptions = (options = {}) => ({
  ...themedOptions(),
  ...options,
  customClass: {
    ...themedOptions().customClass,
    ...(options.customClass || {}),
  },
})

export const showAlert = options => Swal.fire(mergeOptions(options))

export async function confirmAction(options = {}) {
  const result = await showAlert({
    icon: 'warning',
    showCancelButton: true,
    cancelButtonText: 'Cancel',
    confirmButtonText: 'Confirm',
    focusCancel: true,
    ...options,
  })
  return result.isConfirmed
}

export const showSuccess = (title, text = '') => showAlert({
  icon: 'success',
  title,
  text,
})

export const showErrorDialog = (title, text = '') => showAlert({
  icon: 'error',
  title,
  text,
})

export const showToast = (title, icon = 'success') => showAlert({
  toast: true,
  position: 'top-end',
  icon,
  title,
  showConfirmButton: false,
  timer: 2400,
  timerProgressBar: true,
})
