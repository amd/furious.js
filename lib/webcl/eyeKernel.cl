kernel void eye_f32(
    uint rows,
    uint columns,
    int diagonal,
    global float* out)
{
    const uint x = get_global_id(0);
    const uint y = get_global_id(1);

    if (x*y < rows*columns) {
        if ((int) (y - x) == diagonal) {
            out[columns*x + y] = 1.0f;
        } else {
            out[columns*x + y] = 0.0f;
        }
    }
}

kernel void eye_f64(
    uint rows,
    uint columns,
    int diagonal,
    global double* out) 
{
    const uint x = get_global_id(0);
    const uint y = get_global_id(1);

    if (x*y < rows*columns) {
        if ((int) (y - x) == diagonal) {
            out[columns*x + y] = 1.0;
        } else {
            out[columns*x + y] = 0.0;
        }
    }
}


